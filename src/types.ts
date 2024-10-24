import { OpenAI } from 'openai';

// Define types
export type AgentFunction = (...args: any[]) => Promise<any>;

export interface Agent {
    name: string;
    instructions: string | ((context: Record<string, any>) => string);
    model: string;
    functions: { name: string; function: Function }[];
    context?: Record<string, any>; // Add this line to include context
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    parallel_tool_calls?: number | null;
}

export interface Response {
    messages: any[];
    agent: Agent;
    context_variables: Record<string, any>;
}

export interface Result {
    value: string;
    agent: Agent | null;
    context_variables: Record<string, any>;
}

// Add this to the existing types
export interface ToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
    type: string;
}

// Factory functions
export const createAgent = (
    name: string = "Agent",
    model: string = "gpt-4",
    instructions: string | ((contextVariables: Record<string, any>) => string) = "You are a helpful agent.",
    functions: Array<{ name: string; function: AgentFunction }> = [],
    tool_choice: Agent['tool_choice'] = undefined,
    parallel_tool_calls: number | null = null
): Agent => ({
    name,
    model,
    instructions,
    functions,
    tool_choice,
    parallel_tool_calls,
});

export const createResponse = (
    messages: (OpenAI.ChatCompletionMessageParam | OpenAI.ChatCompletionMessage)[],
    agent: Agent,
    context_variables: Record<string, any>
): Response => ({
    messages,
    agent,
    context_variables,
});

export const createResult = (
    value: string = "",
    agent: Agent | null = null,
    context_variables: Record<string, any> = {}
): Result => ({
    value,
    agent,
    context_variables,
});
