import { OpenAI } from 'openai';
import { Assistant } from '../agents/Assistant';
import { Task, EvaluationTask } from '../types/Task';
import { Engine } from './Engine';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { TRIAGE_SYSTEM_PROMPT, TRIAGE_MESSAGE_PROMPT, EVALUATE_TASK_PROMPT } from '../config/prompts';
import { getCompletion } from '../utils/openai';
import { format } from '../utils/string';
import console from 'console';
import { Tool } from '../types/Tool';
import { setTimeout } from 'timers';
import { triageAssistant, salesAssistant, refundsAssistant } from '../../examples/assistants-demo/assistants';
import { isAssistant } from '../types/Assistant';  // Add this import
import { isTransferResponse } from '../types/Transfer';
import { TransferResponse } from '../types/Transfer';
import { ThreadError, TransferError } from '../types/TransferError';

// Define proper types for OpenAI responses
type Thread = OpenAI.Beta.Threads.Thread;
type Message = OpenAI.Beta.Threads.Messages.Message;

// Update tool output types to match OpenAI's types
type ToolCallOutput = {
    tool_call_id: string;
    output: string;
};

type RunSubmitToolOutputs = {
    tool_outputs: ToolCallOutput[];
};

type Run = OpenAI.Beta.Threads.Run;

export class AssistantsEngine implements Engine {
    private client: OpenAI;
    private assistants: Assistant[];
    private tasks: Task[];
    private thread!: Thread;
    private currentTask: Task | null = null;
    private currentRun: Run | null = null;

    constructor(client: OpenAI, tasks: Task[]) {
        this.client = client;
        this.assistants = [];
        this.tasks = tasks;
        this.initializeThread().then(thread => {
            this.thread = thread;
        });
    }

    private async initializeThread(): Promise<Thread> {
        const thread = await this.client.beta.threads.create();
        return thread;
    }

    private async resetThread(): Promise<void> {
        this.thread = await this.client.beta.threads.create();
    }

    private async loadAllAssistants(): Promise<void> {
        const basePath = "assistants";
        const toolsBasePath = "tools";

        // Load tool definitions
        const toolDefs: Record<string, Tool['function']> = {};
        const toolDirs = await fs.readdir(toolsBasePath);

        for (const toolDir of toolDirs) {
            if (toolDir === "__pycache__") continue;

            const toolDirPath = path.join(toolsBasePath, toolDir);
            const toolJsonPath = path.join(toolDirPath, "tool.json");

            try {
                const stat = await fs.stat(toolDirPath);
                if (stat.isDirectory()) {
                    const toolDefContent = await fs.readFile(toolJsonPath, 'utf-8');
                    const toolDef = JSON.parse(toolDefContent) satisfies Tool;
                    toolDefs[toolDef.function.name] = toolDef.function;
                }
            } catch (error) {
                console.error(`Error loading tool from ${toolDirPath}:`, error);
            }
        }

        // Load assistants
        const assistantDirs = await fs.readdir(basePath);
        for (const assistantDir of assistantDirs) {
            if (assistantDir === "__pycache__") continue;

            const assistantConfigPath = path.join(basePath, assistantDir, "assistant.json");
            try {
                const configContent = await fs.readFile(assistantConfigPath, 'utf-8');
                const assistantConfig = JSON.parse(configContent)[0];

                const assistantName: string = assistantConfig.name || assistantDir;
                const logFlag = assistantConfig.log_flag || false;
                const assistantToolsNames: string[] = assistantConfig.tools || [];

                // Build tool definitions for this assistant
                const assistantTools: Tool[] = assistantToolsNames
                    .filter((name: string) => name in toolDefs)
                    .map((name: string) => ({
                        name: name,  // Ensure name is always provided
                        function: toolDefs[name]
                    }));

                // Create or update assistant instance
                const existingAssistants = await this.client.beta.assistants.list();
                let loadedAssistant = existingAssistants.data.find(a => a.name === assistantName);

                if (!loadedAssistant) {
                    const tools = assistantToolsNames.map(name => ({
                        type: "function" as const,
                        function: toolDefs[name]
                    }));

                    loadedAssistant = await this.client.beta.assistants.create({
                        ...assistantConfig,
                        tools,
                        name: assistantName
                    });
                    console.log(`Assistant '${assistantName}' created.\n`);
                }

                const assistant = new Assistant(
                    assistantName,
                    assistantTools,
                    { history: [] },
                    {
                        logFlag: logFlag,
                        instance: loadedAssistant
                    }
                );
                this.assistants.push(assistant);
            } catch (error) {
                console.error(`Error loading assistant from ${assistantConfigPath}:`, error);
            }
        }
    }

    private async initializeAndDisplayAssistants(): Promise<void> {
        // Instead of loading from filesystem, use the assistants passed in tasks
        this.assistants = this.tasks
            .map(task => {
                if (typeof task.assistant === 'string') {
                    switch (task.assistant) {
                        case 'Triage Assistant':
                            return triageAssistant;
                        case 'Sales Assistant':
                            return salesAssistant;
                        case 'Refunds Assistant':
                            return refundsAssistant;
                        default:
                            return null;
                    }
                }
                return null;
            })
            .filter(isAssistant);  // Use the type guard instead of inline type predicate

        // Create OpenAI assistants if they don't exist
        for (const asst of this.assistants) {
            console.log(`\n${chalk.magenta('Initializing assistant:')}`);
            console.log(`${chalk.blue('Assistant name:')} ${chalk.bold(asst.name)}`);

            // Check if assistant already exists
            const existingAssistants = await this.client.beta.assistants.list();
            let assistantInstance = existingAssistants.data.find(a => a.name === asst.name);

            if (!assistantInstance) {
                console.log(`Creating new assistant: ${asst.name}`);

                // Handle instructions that could be a string or function
                let instructions: string;
                if (typeof asst.instructions === 'function') {
                    instructions = await asst.instructions({});
                } else {
                    instructions = asst.instructions;
                }

                assistantInstance = await this.client.beta.assistants.create({
                    name: asst.name,
                    instructions,
                    tools: asst.tools.map(tool => ({
                        type: "function" as const,
                        function: {
                            name: tool.name,
                            description: "Function to query documentation",
                            parameters: {
                                type: "object",
                                properties: {
                                    query: {
                                        type: "string",
                                        description: "The search query"
                                    },
                                    collection: {
                                        type: "string",
                                        description: "The collection to search in"
                                    }
                                },
                                required: ["query"]
                            }
                        }
                    })),
                    model: "gpt-4-1106-preview"
                });
            }

            // Always update the instance, whether it's new or existing
            asst.updateOptions({ instance: assistantInstance });

            if (assistantInstance?.tools) {
                console.log(`${chalk.green('Tools:')} ${JSON.stringify(assistantInstance.tools)} \n`);
            } else {
                console.log(`${chalk.green('Tools:')} Not available \n`);
            }
        }
    }

    private getAssistant(assistantName: string): Assistant | null {
        const assistant = this.assistants.find(a => a.name === assistantName);
        if (!assistant) {
            console.log("No assistant found");
            return null;
        }
        return assistant;
    }

    private async triageRequest(message: string, testMode: boolean): Promise<Assistant | null> {
        // Get list of available assistant names
        const assistantNames = this.assistants.map(a => a.name).join(', ');

        // Get the completion using the triage prompts
        const response = await getCompletion(this.client, [
            { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
            { role: 'user', content: TRIAGE_MESSAGE_PROMPT.replace('{}', message).replace('{}', assistantNames) }
        ]);

        const selectedAssistantName = response.choices[0]?.message?.content?.trim();
        if (!selectedAssistantName) {
            return null;
        }

        const selectedAssistant = this.getAssistant(selectedAssistantName);
        if (!testMode && selectedAssistant) {
            console.log(`${chalk.green('\nSelected Assistant:')} ${chalk.bold(selectedAssistant.name)}`);
        }

        return selectedAssistant;
    }

    private async runRequest(input: string, assistant: Assistant, testMode: boolean): Promise<unknown> {
        try {
            const assistantInstance = assistant.getInstance();
            if (!assistantInstance?.id) {
                throw new Error('Assistant instance or ID not found');
            }

            console.log("Creating message with content:", input);
            await this.client.beta.threads.messages.create(this.thread.id, {
                role: "user",
                content: input
            });

            console.log("Creating run for assistant:", assistantInstance.id);
            this.currentRun = await this.client.beta.threads.runs.create(
                this.thread.id,
                {
                    assistant_id: assistantInstance.id,
                    instructions: assistant.instructions.toString()
                }
            );

            let runStatus = this.currentRun;
            console.log("Initial run status:", runStatus.status);

            while (runStatus.status === 'queued' || runStatus.status === 'in_progress' || runStatus.status === 'requires_action') {
                if (runStatus.status === 'requires_action') {
                    const toolCalls = runStatus.required_action?.submit_tool_outputs.tool_calls;
                    console.log("Tool calls received:", toolCalls);

                    if (toolCalls) {
                        const toolOutputPromises = toolCalls.map(async toolCall => {
                            console.log("Processing tool call:", toolCall.function.name, toolCall.function.arguments);

                            const tool = assistant.tools.find(t => t.name === toolCall.function.name) ||
                                assistant.functions.find(f => f.name === toolCall.function.name);

                            if (tool) {
                                const args = JSON.parse(toolCall.function.arguments);
                                const result = await tool.function(args);

                                if (isTransferResponse(result)) {
                                    const targetAssistant = this.assistants.find(a => a.name === result.assistant);
                                    if (targetAssistant) {
                                        await this.resetThread();
                                        return this.runRequest(result.context.request, targetAssistant, testMode);
                                    }
                                }

                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify(result)
                                } as const;
                            }

                            return {
                                tool_call_id: toolCall.id,
                                output: JSON.stringify({ error: 'Unknown tool' })
                            } as const;
                        });

                        const toolOutputs = await Promise.all(toolOutputPromises) as ToolCallOutput[];

                        const submitParams: RunSubmitToolOutputs = {
                            tool_outputs: toolOutputs
                        };

                        await this.client.beta.threads.runs.submitToolOutputs(
                            this.thread.id,
                            this.currentRun.id,
                            submitParams
                        );
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                runStatus = await this.client.beta.threads.runs.retrieve(this.thread.id, this.currentRun.id);
                console.log("Updated run status:", runStatus.status);
            }

            const messages = await this.client.beta.threads.messages.list(this.thread.id);
            const lastMessage = messages.data[0];
            const content = lastMessage.content[0];

            if ('text' in content) {
                const response = content.text.value;

                // Check for routing commands
                if (response.startsWith('ROUTE_TO:')) {
                    const targetAssistant = this.assistants.find(a =>
                        a.name === response.replace('ROUTE_TO:', '').trim()
                    );
                    if (targetAssistant) {
                        console.log(`\nRouting to ${targetAssistant.name}...`);
                        return this.runRequest(input, targetAssistant, testMode);
                    }
                }

                return response;
            }
            return null;
        } catch (error) {
            this.currentRun = null; // Reset on error
            console.error('Error in runRequest:', error);
            throw error;
        }
    }

    private async saveConversation(messages: Message[], filename: string): Promise<void> {
        try {
            await fs.mkdir(path.dirname(filename), { recursive: true });

            let existingThreads: unknown[] = [];
            try {
                const existingContent = await fs.readFile(filename, 'utf-8');
                existingThreads = JSON.parse(existingContent);
            } catch {
                // File doesn't exist or is empty, start with empty array
            }

            existingThreads.push(messages);
            await fs.writeFile(filename, JSON.stringify(existingThreads, null, 4));
        } catch (error) {
            console.error(`Error while saving to file: ${error}`);
        }
    }

    public async runTask(task: Task, testMode: boolean): Promise<unknown> {
        if (!testMode) {
            console.log(`${chalk.cyan('User Query:')} ${chalk.bold(task.description)}`);
        } else {
            console.log(`${chalk.cyan('Test:')} ${chalk.bold(task.description)}`);
        }

        let assistant: Assistant | null;
        if (task.assistant === 'auto') {
            // Triage the request to determine the appropriate assistant
            assistant = await this.triageRequest(task.description, testMode);
        } else {
            // Fetch the specified assistant
            assistant = this.getAssistant(task.assistant);
            if (assistant) {
                console.log(`${chalk.green('\nSelected Assistant:')} ${chalk.bold(assistant.name)}`);
            }
        }

        if (testMode && assistant) {
            task.assistant = assistant.name;
        }

        if (!assistant) {
            if (!testMode) {
                console.log(`No suitable assistant found for the task: ${task.description}`);
            }
            return null;
        }

        // Run the request with the determined or specified assistant
        await this.resetThread();
        return await this.runRequest(task.description, assistant, testMode);
    }

    public async deploy(client: OpenAI, testMode = false, testFilePath?: string): Promise<void> {
        this.client = client;
        if (testMode && testFilePath) {
            console.log("\nTesting the swarm\n\n");
            await this.loadTestTasks(testFilePath);
        } else {
            console.log("\n🐝🐝🐝 Deploying the swarm 🐝🐝🐝\n\n");
        }

        await this.initializeAndDisplayAssistants();

        let totalTests = 0;
        let groundtruthTests = 0;
        let assistantTests = 0;

        for (const task of this.tasks) {
            const output = await this.runTask(task, testMode);

            if (testMode && task instanceof EvaluationTask && task.groundtruth) {
                totalTests++;

                const response = await getCompletion(this.client, [{
                    role: 'user',
                    content: format(EVALUATE_TASK_PROMPT, output, task.groundtruth)
                }]);

                if (response.choices[0]?.message?.content === 'True') {
                    groundtruthTests++;
                    console.log(
                        `${chalk.green('✔ Groundtruth test passed for:')} ${task.description}\n` +
                        `${chalk.blue('Expected:')} ${task.groundtruth}\n` +
                        `${chalk.blue('Got:')} ${output}\n`
                    );
                } else {
                    console.log(
                        `${chalk.red('✘ Test failed for:')} ${task.description}\n` +
                        `${chalk.blue('Expected:')} ${task.groundtruth}\n` +
                        `${chalk.blue('Got:')} ${output}\n`
                    );
                }

                if (task.assistant === task.expected_assistant) {
                    console.log(
                        `${chalk.green('✔ Correct assistant assigned for:')} ${task.description}\n` +
                        `${chalk.blue('Expected:')} ${task.expected_assistant}\n` +
                        `${chalk.blue('Got:')} ${task.assistant}\n`
                    );
                    assistantTests++;
                } else {
                    console.log(
                        `${chalk.red('✘ Incorrect assistant assigned for:')} ${task.description}\n` +
                        `${chalk.blue('Expected:')} ${task.expected_assistant}\n` +
                        `${chalk.blue('Got:')} ${task.assistant}\n`
                    );
                }
            }
        }

        if (testMode) {
            console.log(
                `\n${chalk.green(`Passed ${groundtruthTests} groundtruth tests out of ${totalTests} tests. ` +
                    `Success rate: ${(groundtruthTests / totalTests * 100).toFixed(2)}%`)}\n`
            );
            console.log(
                `${chalk.green(`Passed ${assistantTests} assistant tests out of ${totalTests} tests. ` +
                    `Success rate: ${(assistantTests / totalTests * 100).toFixed(2)}%`)}\n`
            );
            console.log("Completed testing the swarm\n\n");
        } else {
            console.log("🍯🐝🍯 Swarm operations complete 🍯🐝🍯\n\n");
        }
    }

    public async loadTestTasks(testFilePath: string): Promise<void> {
        this.tasks = []; // Clear any existing tasks
        const fileContent = await fs.readFile(testFilePath, 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const testCase = JSON.parse(line);
            const task = new EvaluationTask({
                description: testCase.text,
                assistant: testCase.assistant || 'auto',
                groundtruth: testCase.groundtruth,
                expected_assistant: testCase.expected_assistant,
                iterate: false,
                evaluate: true
            });
            this.tasks.push(task);
        }
    }

    private async createAssistant(assistant: Assistant): Promise<OpenAI.Beta.Assistant> {
        const openAIAssistant = await this.client.beta.assistants.create({
            name: assistant.name,
            instructions: assistant.instructions.toString(),
            tools: assistant.tools.map(tool => ({
                type: "function" as const,
                function: {
                    name: tool.name,
                    description: "Function to query documentation",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query"
                            },
                            collection: {
                                type: "string",
                                description: "The collection to search in"
                            }
                        },
                        required: ["query"]
                    }
                }
            })),
            model: assistant.model || "gpt-4-1106-preview"  // Add default model
        });

        assistant.updateOptions({
            instance: openAIAssistant
        });

        return openAIAssistant;
    }

    private async handleTransfer(
        response: TransferResponse,
        currentThread: Thread,
        currentRun: Run | null
    ): Promise<void> {
        if (!currentThread?.id) {
            throw new ThreadError('Invalid thread');
        }

        if (!currentRun?.id) {
            throw new ThreadError('Invalid run state');
        }

        // Cancel the current run before switching tasks
        await this.client.beta.threads.runs.cancel(
            currentThread.id,
            currentRun.id
        );

        const targetTask = this.tasks.find(t => t.assistant === response.assistant);
        if (!targetTask) {
            throw new TransferError(`No task found for assistant: ${response.assistant}`);
        }

        this.currentTask = targetTask;
        this.currentRun = null; // Reset run state for new task
    }

    // It should be called in the execute method when we detect a transfer response
    public async execute(userInput: string): Promise<void> {
        try {
            if (!this.currentTask?.assistant) {
                throw new Error('No current task or assistant set');
            }

            // Get the actual Assistant object using the name
            const assistant = this.assistants.find(a => a.name === this.currentTask?.assistant);
            if (!assistant) {
                throw new Error(`No assistant found with name: ${this.currentTask?.assistant}`);
            }

            const response = await this.runRequest(
                userInput,
                assistant,
                false
            );

            if (response && isTransferResponse(response)) {
                await this.handleTransfer(
                    response,
                    this.thread,
                    this.currentRun
                );
            }
        } catch (error) {
            console.error('Error executing request:', error);
            throw error;
        }
    }
}
