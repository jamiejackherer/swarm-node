import { Tool } from './Tool';

export interface Agent {
    name: string;
    instructions: string | ((context: Record<string, any>) => string);
    model: string;
    functions: { name: string; function: Function }[];
    context?: Record<string, any>;
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    parallel_tool_calls?: number | null;
    tools?: Tool[];
}

export const createAgent = (
    name: string = "Agent",
    model: string = "gpt-4",
    instructions: string | ((contextVariables: Record<string, any>) => string) = "You are a helpful agent.",
    functions: Array<{ name: string; function: Function }> = [],
    tool_choice: Agent['tool_choice'] = undefined,
    parallel_tool_calls: number | null = null,
    tools: Tool[] = []
): Agent => ({
    name,
    model,
    instructions,
    functions,
    tool_choice,
    parallel_tool_calls,
    tools,
});
