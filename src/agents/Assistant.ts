import { Agent } from '../types';
import { Tool } from '../types/Tool';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { EVALUATE_TASK_PROMPT } from '../config/prompts';
import { getCompletion } from '../utils/openai';
import chalk from 'chalk';
import console from 'console';
import { Conversation } from '../core/Conversation';
import { Message } from '../types/Message';

export class Assistant implements Agent {
    // Public properties required by Agent interface
    public name: string;
    public instructions: string | ((context: Record<string, string>) => Promise<string>);
    public model: string;
    public functions: Array<{
        name: string;
        function: (...args: unknown[]) => Promise<unknown>;
    }>;
    public tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
    public parallel_tool_calls?: boolean;
    public context: { history: Message[] };

    // Private properties
    private conversation: Conversation;
    private log_flag: boolean;
    private current_task_id: string | null = null;
    private sub_assistants: Assistant[] | null = null;
    private runs: unknown[] = [];
    private planner: 'sequential' | 'parallel' = 'sequential';
    private instance?: OpenAI.Beta.Assistant;

    constructor(
        name: string,
        public readonly tools: Tool[],
        context: { history: Message[] } = { history: [] },
        logFlag: boolean = false,
        options: {
            instructions?: string | ((context: Record<string, string>) => Promise<string>);
            model?: string;
            tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
            parallel_tool_calls?: boolean;
            context?: { history: Message[] };
            logFlag?: boolean;
            instance?: OpenAI.Beta.Assistant;
        } = {}
    ) {
        this.name = name;
        this.log_flag = logFlag || options.logFlag || false;
        this.conversation = new Conversation();
        this.context = context;

        // Initialize required Agent properties
        this.instructions = options.instructions || "You are a helpful assistant.";
        this.model = options.model || "gpt-4";
        this.functions = tools.map(tool => ({
            name: tool.name,
            function: tool.function
        }));
        this.tool_choice = options.tool_choice || "auto";
        this.parallel_tool_calls = options.parallel_tool_calls || false;
        this.instance = options.instance;
    }

    getInstance(): OpenAI.Beta.Assistant | undefined {
        return this.instance;
    }

    initializeHistory(): void {
        this.context.history = [];
    }

    addUserMessage(message: string): void {
        this.context.history.push({
            task_id: this.current_task_id || undefined,
            role: 'user',
            content: message
        });
    }

    addAssistantMessage(message: string): void {
        this.context.history.push({
            task_id: this.current_task_id || undefined,
            role: 'assistant',
            content: message
        });
    }

    addToolMessage(message: { tool: string; args: Record<string, unknown> }): void {
        this.context.history.push({
            task_id: this.current_task_id || undefined,
            role: 'user',
            content: `Tool used: ${message.tool}`,
            tool: message
        });
    }

    printConversation(): void {
        console.log(chalk.gray(`\nConversation with Assistant: ${this.name}\n`));

        const messagesByTaskId: Record<string, Message[]> = {};
        for (const message of this.context.history) {
            const taskId = message.task_id || 'default';
            if (!messagesByTaskId[taskId]) {
                messagesByTaskId[taskId] = [];
            }
            messagesByTaskId[taskId].push(message);
        }

        for (const [taskId, messages] of Object.entries(messagesByTaskId)) {
            console.log(chalk.cyan(`Task ID: ${taskId}`));
            for (const message of messages) {
                if (message.role === 'user') {
                    console.log(chalk.blue(`User: ${message.content}`));
                } else if (message.tool) {
                    const toolArgs = Object.entries(message.tool.args)
                        .map(([arg, value]) => `${arg}: ${value}`)
                        .join(', ');
                    console.log(chalk.green(`Tool: ${message.tool.tool}(${toolArgs})`));
                } else if (message.role === 'assistant') {
                    console.log(chalk.magenta(`Assistant: ${message.content}`));
                }
            }
            console.log('\n');
        }
    }

    async evaluate(client: OpenAI, task: { description: string }, planLog: string): Promise<unknown> {
        const output = await getCompletion(client, [{
            role: 'user',
            content: EVALUATE_TASK_PROMPT.replace('{task}', task.description).replace('{plan_log}', planLog)
        }]);

        const content = output.choices[0]?.message?.content;
        if (!content) {
            console.error("No content in the response");
            return null;
        }

        const cleanContent = content.replace(/'/g, '"');
        try {
            return JSON.parse(cleanContent);
        } catch {
            console.error("An error occurred while decoding the JSON.");
            return null;
        }
    }

    async saveConversation(test: boolean = false): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        const filename = test
            ? `tests/test_runs/test_${timestamp}.json`
            : `logs/session_${timestamp}.json`;

        await fs.writeFile(filename, JSON.stringify(this.context.history, null, 2));
    }

    passContext(assistant: Assistant): void {
        assistant.context.history = [...this.context.history];
    }

    setCurrentTaskId(taskId: string): void {
        this.current_task_id = taskId;
    }

    setSubAssistants(assistants: Assistant[]): void {
        this.sub_assistants = assistants;
    }

    setPlanner(planner: 'sequential' | 'parallel'): void {
        this.planner = planner;
    }

    async evaluateTask(task: {
        description: string,
        groundtruth?: string,
        expected_plan?: string,
        expected_assistant?: string
    }): Promise<{
        success: boolean,
        message: string
    }> {
        if (task.groundtruth) {
            // Evaluate against groundtruth
            return this.evaluateGroundtruth(task.description, task.groundtruth);
        } else if (task.expected_plan) {
            // Evaluate against expected plan
            return this.evaluatePlan(task.description, task.expected_plan);
        } else if (task.expected_assistant) {
            // Evaluate assistant selection
            return this.evaluateAssistantSelection(task.expected_assistant);
        }

        return {
            success: false,
            message: "No evaluation criteria provided"
        };
    }

    private async evaluateGroundtruth(description: string, groundtruth: string): Promise<{
        success: boolean,
        message: string
    }> {
        // Implement actual comparison logic here
        // This is where you'd compare the assistant's output with the groundtruth
        const result = await this.run(description);
        const matches = result.toLowerCase().includes(groundtruth.toLowerCase());

        return {
            success: matches,
            message: matches ?
                "Output matches groundtruth" :
                "Output differs from groundtruth"
        };
    }

    private async evaluatePlan(description: string, expectedPlan: string): Promise<{
        success: boolean,
        message: string
    }> {
        // Compare the current plan with expected plan
        // This is a simple implementation - you might want to make it more sophisticated
        const currentPlan = await this.generatePlan(description);
        const planMatches = currentPlan.toLowerCase().includes(expectedPlan.toLowerCase());

        return {
            success: planMatches,
            message: planMatches ?
                "Plan matches expected outcome" :
                "Plan differs from expected outcome"
        };
    }

    private async evaluateAssistantSelection(expectedAssistant: string): Promise<{
        success: boolean,
        message: string
    }> {
        // Compare if the current assistant matches the expected one
        const success = this.name === expectedAssistant;

        return {
            success,
            message: success ?
                "Correct assistant selected" :
                `Expected ${expectedAssistant}, but got ${this.name}`
        };
    }

    // Helper method to generate a plan
    private async generatePlan(description: string): Promise<string> {
        // Implement plan generation logic here
        // This is a placeholder - implement actual plan generation
        return "Generated plan for: " + description;
    }

    // Helper method to run a task
    private async run(description: string): Promise<string> {
        // Implement actual task execution logic here
        // This is a placeholder - implement actual task execution
        return "Task output for: " + description;
    }
}
