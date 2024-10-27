import { Tool } from './Tool';
import { InstructionsFunction, AgentFunction } from './SharedTypes';

export interface Agent {
    name: string;
    instructions: string | InstructionsFunction;
    model: string;
    functions: Array<{
        name: string;
        function: AgentFunction;
    }>;
    context?: Record<string, unknown>;
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    parallel_tool_calls?: boolean;
    tools?: Tool[];
}

export const createAgent = (
    name: string = "Agent",
    model: string = "gpt-4",
    instructions: string | InstructionsFunction = "You are a helpful agent.",
    functions: Array<{ name: string; function: AgentFunction }> = [],
    tool_choice: Agent['tool_choice'] = undefined,
    parallel_tool_calls?: boolean,
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
