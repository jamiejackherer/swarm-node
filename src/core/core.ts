import OpenAI from 'openai';
import { Agent, Response, createResponse, Result, createResult, ToolCall } from './types';
import { debugPrint, mergeChunk, functionToJson, FunctionJson } from './utils';
import dotenv from 'dotenv';

dotenv.config();

/**
 * The name of the context variables in the function parameters.
 */
const CTX_VARS_NAME = "context_variables";

/**
 * Type alias for context variables.
 */
type ContextVariables = Record<string, string>;

/**
 * Retrieves a context variable by key.
 * @param variables - The context variables object.
 * @param key - The key of the variable to retrieve.
 * @returns The value of the context variable, or an empty string if not found.
 */
function getContextVariable(variables: ContextVariables, key: string): string {
    return variables[key] || '';
}

/**
 * Extended type for ChatCompletionMessage to include sender and additional properties.
 */
type ExtendedChatCompletionMessage = OpenAI.ChatCompletionMessage & {
    sender?: string;
    tool_calls?: OpenAI.ChatCompletionMessageToolCall[];
    refusal: string | null;
};

/**
 * Extended type for ChatCompletionChunk delta to include sender.
 */
type ExtendedDelta = OpenAI.Chat.Completions.ChatCompletionChunk['choices'][0]['delta'] & {
    sender?: string;
};

/**
 * Extended type for ChatCompletionCreateParams to include parallel_tool_calls.
 */
type ExtendedChatCompletionCreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParams & {
    parallel_tool_calls?: number;
};

/**
 * The main Swarm class that handles the interaction with OpenAI's API and manages the conversation flow.
 */
export class Swarm {
    private client: OpenAI;

    /**
     * Constructs a new Swarm instance.
     * @throws Error if OPENAI_API_KEY is not set in the environment variables.
     */
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not set in the environment variables');
        }
        this.client = new OpenAI({ apiKey });
    }

    /**
     * Retrieves the system message for an agent.
     * @param agent - The agent to get the system message for.
     * @param contextVariables - The context variables.
     * @returns A promise that resolves to the system message.
     */
    private async getSystemMessage(agent: Agent, contextVariables: Record<string, any>): Promise<OpenAI.ChatCompletionMessageParam> {
        return {
            role: "system",
            content: typeof agent.instructions === 'function'
                ? await agent.instructions(contextVariables)
                : agent.instructions
        };
    }

    /**
     * Gets a chat completion from the OpenAI API.
     * @param agent - The agent to use for the completion.
     * @param messages - The conversation messages.
     * @param contextVariables - The context variables.
     * @param modelOverride - Optional model override.
     * @param stream - Whether to stream the response.
     * @param debug - Whether to enable debug mode.
     * @returns A promise that resolves to the chat completion or an async iterable of chat completion chunks.
     */
    private async getChatCompletion(
        agent: Agent,
        messages: OpenAI.ChatCompletionMessageParam[],
        contextVariables: ContextVariables,
        modelOverride: string | null,
        stream: boolean,
        debug: boolean
    ): Promise<OpenAI.Chat.Completions.ChatCompletion | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
        const systemMessage = await this.getSystemMessage(agent, contextVariables);

        debugPrint(debug, "Getting chat completion for:", [systemMessage, ...messages]);

        const tools: OpenAI.ChatCompletionTool[] = await Promise.all(agent.functions.map(async f => ({
            type: 'function',
            function: await this.functionToJsonSimple(f)
        })));

        // Hide context_variables from model in function parameters
        tools.forEach(tool => {
            const params = tool.function.parameters;
            if (params && typeof params === 'object' && 'properties' in params) {
                delete (params.properties as Record<string, unknown>)[CTX_VARS_NAME];
                if (Array.isArray(params.required)) {
                    params.required = params.required.filter((prop: string) => prop !== CTX_VARS_NAME);
                }
            }
        });

        console.log("[DEBUG] Tools being sent to API:", JSON.stringify(tools, null, 2));

        const createParams: ExtendedChatCompletionCreateParams = {
            model: modelOverride || agent.model,
            messages: [systemMessage, ...messages],
            stream: stream,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: agent.tool_choice || undefined,
        };

        if (tools.length > 0 && agent.parallel_tool_calls) {
            (createParams as any).parallel_tool_calls = agent.parallel_tool_calls;
        }

        return this.client.chat.completions.create(createParams);
    }

    /**
     * Converts a function to a simplified JSON representation.
     * @param func - The function to convert.
     * @returns A promise that resolves to the JSON representation of the function.
     */
    private async functionToJsonSimple(func: { name: string, function: Function }): Promise<OpenAI.ChatCompletionCreateParams.Function> {
        const paramNames = await this.getParamNames(func.function);
        const result: OpenAI.ChatCompletionCreateParams.Function = {
            name: func.name,
            description: "Function description",
            parameters: {
                type: "object",
                properties: Object.fromEntries(paramNames.map(param => [param, { type: "string" }])),
                required: paramNames
            }
        };
        console.log(`[DEBUG] Function to JSON result:`, JSON.stringify(result, null, 2));
        return result;
    }

    /**
     * Gets the parameter names of a function.
     * @param func - The function to get parameter names for.
     * @returns A promise that resolves to an array of parameter names.
     */
    private async getParamNames(func: Function): Promise<string[]> {
        const funcStr = func.toString();
        const match = funcStr.match(/\(([^)]*)\)/);
        return match ? match[1].split(',').map(param => param.trim()) : [];
    }

    /**
     * Checks if a value is a Result object.
     * @param value - The value to check.
     * @returns A promise that resolves to true if the value is a Result, false otherwise.
     */
    private async isResult(value: any): Promise<boolean> {
        return value && typeof value === 'object' && 'value' in value;
    }

    /**
     * Checks if a value is an Agent object.
     * @param value - The value to check.
     * @returns A promise that resolves to true if the value is an Agent, false otherwise.
     */
    private async isAgent(value: any): Promise<boolean> {
        const isAgent = value && typeof value === 'object' && 'name' in value && 'functions' in value;
        console.log(`[DEBUG] isAgent check: ${isAgent}, value:`, value);
        return isAgent;
    }

    /**
     * Handles the result of a function call.
     * @param result - The result to handle.
     * @param debug - Whether to enable debug mode.
     * @returns A promise that resolves to a Result object.
     */
    private async handleFunctionResult(result: any, debug: boolean): Promise<Result> {
        console.log(`[DEBUG] handleFunctionResult input:`, result);

        if (await this.isAgent(result)) {
            console.log(`[DEBUG] Detected agent in function result: ${result.name}`);
            return {
                value: JSON.stringify({ agent: result.name }),
                agent: result,
                context_variables: result.context || {}
            };
        }

        if (await this.isResult(result)) {
            return result;
        }

        return {
            value: typeof result === 'string' ? result : JSON.stringify(result),
            agent: null,
            context_variables: {}
        };
    }

    /**
     * Handles tool calls made by the AI.
     * @param toolCalls - The tool calls to handle.
     * @param agent - The current agent.
     * @param contextVariables - The context variables.
     * @param debug - Whether to enable debug mode.
     * @returns A promise that resolves to an object containing messages, context variables, and the potentially updated agent.
     */
    private async handleToolCalls(
        toolCalls: OpenAI.ChatCompletionMessageToolCall[],
        agent: Agent,
        contextVariables: ContextVariables,
        debug: boolean
    ): Promise<{ messages: OpenAI.ChatCompletionMessageParam[], context_variables: ContextVariables, agent: Agent }> {
        const messages: OpenAI.ChatCompletionMessageParam[] = [];
        let newAgent: Agent | undefined;

        for (const toolCall of toolCalls) {
            console.log(`[DEBUG] Full toolCall object:`, JSON.stringify(toolCall, null, 2));
            console.log(`[DEBUG] Handling tool call: ${toolCall.function.name}`);
            const func = agent.functions.find(f => f.name === toolCall.function.name);
            if (!func) {
                console.error(`Function ${toolCall.function.name} not found`);
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Error: Function ${toolCall.function.name} not found`
                });
                continue;
            }

            const args = JSON.parse(toolCall.function.arguments || '{}');
            const request = getContextVariable(contextVariables, 'request');
            const rawResult = await func.function({ request, ...args });
            const result = await this.handleFunctionResult(rawResult, debug);
            console.log(`[DEBUG] Function result:`, result);

            if (result.agent) {
                newAgent = result.agent;
                contextVariables = { ...contextVariables, ...result.context_variables };
            }

            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: String(result.value)
            });
        }

        console.log(`[DEBUG] handleToolCalls returning agent: ${(newAgent || agent).name}`);
        return { messages, context_variables: contextVariables, agent: newAgent || agent };
    }

    /**
     * Runs a conversation with the AI.
     * @param agent - The starting agent.
     * @param messages - The initial messages.
     * @param contextVariables - The initial context variables.
     * @param modelOverride - Optional model override.
     * @param stream - Whether to stream the response.
     * @param debug - Whether to enable debug mode.
     * @param maxTurns - The maximum number of turns in the conversation.
     * @param executeTool - Whether to execute tool calls.
     * @returns A promise that resolves to a Response object.
     */
    async run(
        agent: Agent,
        messages: OpenAI.ChatCompletionMessageParam[],
        contextVariables: Record<string, any> = {},
        modelOverride: string | null = null,
        stream: boolean = false,
        debug: boolean = false,
        maxTurns: number = Infinity,
        executeTool: boolean = true
    ): Promise<Response> {
        let currentAgent = agent;
        let currentMessages = [...messages];
        let currentContextVariables = { ...contextVariables };
        const initLen = messages.length;

        for (let turn = 0; turn < maxTurns; turn++) {
            console.log(`[DEBUG] Turn ${turn + 1}, Current Agent: ${currentAgent.name}`);

            const completion = await this.getChatCompletion(
                currentAgent,
                currentMessages,
                currentContextVariables,
                modelOverride,
                stream,
                debug
            );

            if (!('choices' in completion) || !completion.choices[0].message) {
                throw new Error('Unexpected completion format');
            }

            const message = completion.choices[0].message;
            currentMessages.push(message);

            if (message.tool_calls && executeTool) {
                const toolResponse = await this.handleToolCalls(
                    message.tool_calls,
                    currentAgent,
                    currentContextVariables,
                    debug
                );

                currentMessages.push(...toolResponse.messages);
                currentContextVariables = { ...currentContextVariables, ...toolResponse.context_variables };

                if (toolResponse.agent !== currentAgent) {
                    currentAgent = toolResponse.agent;
                    console.log(`[DEBUG] Agent changed to: ${currentAgent.name}`);
                    currentMessages.push({
                        role: "system",
                        content: `Switching to ${currentAgent.name}`
                    });
                    break; // Break the loop after agent transfer
                }
            } else {
                // If there are no tool calls, we can break the loop
                break;
            }
        }

        console.log(`[DEBUG] Final Agent: ${currentAgent.name}`);
        return createResponse(currentMessages.slice(initLen), currentAgent, currentContextVariables);
    }

    /**
     * Runs a conversation with the AI and streams the response.
     * @param agent - The starting agent.
     * @param messages - The initial messages.
     * @param contextVariables - The initial context variables.
     * @param modelOverride - Optional model override.
     * @param debug - Whether to enable debug mode.
     * @param maxTurns - The maximum number of turns in the conversation.
     * @param executeTool - Whether to execute tool calls.
     * @returns An async generator that yields response chunks.
     */
    async *runAndStream(
        agent: Agent,
        messages: OpenAI.ChatCompletionMessageParam[],
        contextVariables: ContextVariables = {},
        modelOverride: string | null = null,
        debug: boolean = false,
        maxTurns: number = Infinity,
        executeTool: boolean = true
    ): AsyncGenerator<any, void, unknown> {
        let activeAgent = agent;
        let currentContextVariables = { ...contextVariables };
        let currentMessages = [...messages];
        const initLen = messages.length;

        while (currentMessages.length - initLen < maxTurns) {
            const message: ExtendedChatCompletionMessage = {
                content: "",
                sender: activeAgent.name,
                role: "assistant",
                function_call: undefined,
                tool_calls: [],
                refusal: null
            };

            const completion = await this.getChatCompletion(
                activeAgent,
                currentMessages,
                currentContextVariables,
                modelOverride,
                true,
                debug
            );

            if (this.isStreamingCompletion(completion)) {
                for await (const chunk of completion) {
                    const delta = chunk.choices[0].delta;
                    if (delta.role === "assistant") {
                        if ('sender' in delta) {
                            (delta as ExtendedDelta).sender = activeAgent.name;
                        }
                    }
                    yield delta;
                    mergeChunk(message, delta);
                }
            } else {
                const responseMessage = completion.choices[0].message;
                Object.assign(message, responseMessage);
                message.sender = activeAgent.name;
                yield completion.choices[0];
            }
            yield { delim: "end" };

            if (message.tool_calls && message.tool_calls.length === 0) {
                message.tool_calls = undefined;
            }
            debugPrint(debug, "Received completion:", message);
            currentMessages.push(message);

            if (!message.tool_calls || !executeTool) {
                debugPrint(debug, "Ending turn.");
                break;
            }

            const partialResponse = await this.handleToolCalls(
                message.tool_calls,
                activeAgent,
                currentContextVariables,
                debug
            );

            currentMessages.push(...partialResponse.messages);
            currentContextVariables = { ...currentContextVariables, ...partialResponse.context_variables };
            if (partialResponse.agent) {
                activeAgent = partialResponse.agent;
            }

            yield {
                response: createResponse(
                    currentMessages.slice(initLen),
                    activeAgent,
                    currentContextVariables
                )
            };
        }
    }

    /**
     * Checks if a completion is a streaming completion.
     * @param completion - The completion to check.
     * @returns True if the completion is a streaming completion, false otherwise.
     */
    private isStreamingCompletion(
        completion: OpenAI.Chat.Completions.ChatCompletion | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
    ): completion is AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
        return Symbol.asyncIterator in completion;
    }
}
