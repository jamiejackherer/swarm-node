import { OpenAI } from 'openai';

// Define types
/**
 * Type alias for an asynchronous function that can be used as an agent function.
 */
export type AgentFunction = (...args: any[]) => Promise<any>;

/**
 * Interface representing an AI agent.
 */
export interface Agent {
    /** The name of the agent. */
    name: string;
    /** The instructions for the agent, can be a string or a function that returns a string based on context. */
    instructions: string | ((context: Record<string, any>) => string);
    /** The model to be used by the agent. */
    model: string;
    /** An array of functions available to the agent. */
    functions: { name: string; function: Function }[];
    /** Optional context for the agent. */
    context?: Record<string, any>;
    /** Optional tool choice configuration. */
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    /** Optional number of parallel tool calls the agent can make. */
    parallel_tool_calls?: number | null;
}

/**
 * Interface representing a response from the AI.
 */
export interface Response {
    /** An array of messages in the response. */
    messages: any[];
    /** The agent that provided the response. */
    agent: Agent;
    /** Context variables associated with the response. */
    context_variables: Record<string, any>;
}

/**
 * Interface representing the result of an agent's action.
 */
export interface Result {
    /** The value returned by the agent's action. */
    value: string;
    /** The agent that performed the action, or null if no agent change occurred. */
    agent: Agent | null;
    /** Context variables associated with the result. */
    context_variables: Record<string, any>;
}

/**
 * Interface representing a tool call made by the AI.
 */
export interface ToolCall {
    /** The ID of the tool call. */
    id: string;
    /** The function called by the tool. */
    function: {
        /** The name of the function. */
        name: string;
        /** The arguments passed to the function, as a JSON string. */
        arguments: string;
    };
    /** The type of the tool call. */
    type: string;
}

// Factory functions
/**
 * Creates and returns an Agent object.
 * @param name - The name of the agent.
 * @param model - The model to be used by the agent.
 * @param instructions - The instructions for the agent.
 * @param functions - An array of functions available to the agent.
 * @param tool_choice - Optional tool choice configuration.
 * @param parallel_tool_calls - Optional number of parallel tool calls.
 * @returns An Agent object.
 */
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

/**
 * Creates and returns a Response object.
 * @param messages - An array of messages in the response.
 * @param agent - The agent that provided the response.
 * @param context_variables - Context variables associated with the response.
 * @returns A Response object.
 */
export const createResponse = (
    messages: (OpenAI.ChatCompletionMessageParam | OpenAI.ChatCompletionMessage)[],
    agent: Agent,
    context_variables: Record<string, any>
): Response => ({
    messages,
    agent,
    context_variables,
});

/**
 * Creates and returns a Result object.
 * @param value - The value returned by the agent's action.
 * @param agent - The agent that performed the action, or null if no agent change occurred.
 * @param context_variables - Context variables associated with the result.
 * @returns A Result object.
 */
export const createResult = (
    value: string = "",
    agent: Agent | null = null,
    context_variables: Record<string, any> = {}
): Result => ({
    value,
    agent,
    context_variables,
});
