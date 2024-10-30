import { OpenAI } from 'openai';
import { Assistant } from '../agents/Assistant';

export interface AssistantOptions {
    instructions?: string | ((context: Record<string, string>) => Promise<string>);
    model?: string;
    tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
    parallel_tool_calls?: boolean;
    logFlag?: boolean;
    instance?: OpenAI.Beta.Assistant;
}

export function isAssistant(value: unknown): value is Assistant {
    return value !== null &&
        typeof value === 'object' &&
        'name' in value &&
        'tools' in value &&
        'instructions' in value &&
        Array.isArray((value as Assistant).tools);
}
