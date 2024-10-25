import { Tool } from './types/Tool';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { EVALUATE_TASK_PROMPT } from './config/prompts';
import { getCompletion } from './utils/openai';
import chalk from 'chalk';

interface Message {
    task_id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tool?: {
        tool: string;
        args: Record<string, any>;
    };
}

export class Assistant {
    private log_flag: boolean;
    private current_task_id: string | null = null;
    private sub_assistants: Assistant[] | null = null;
    private runs: any[] = [];
    private planner: 'sequential' | 'parallel' = 'sequential';

    constructor(
        public readonly name: string,
        public readonly tools: Tool[],
        private context: { history: Message[] } = { history: [] },
        logFlag: boolean = false
    ) {
        this.log_flag = logFlag;
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

    addToolMessage(message: { tool: string; args: Record<string, any> }): void {
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

    async evaluate(client: OpenAI, task: { description: string }, planLog: string): Promise<any> {
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
        } catch (error) {
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
}
