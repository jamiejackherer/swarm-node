import OpenAI from 'openai';
import { Agent, Response, createResponse, Result, createResult, ToolCall } from './types';
import { debugPrint, mergeChunk, functionToJson, FunctionJson } from './util';
import dotenv from 'dotenv';

dotenv.config();

const CTX_VARS_NAME = "context_variables";

type ContextVariables = Record<string, string>;

function getContextVariable(variables: ContextVariables, key: string): string {
    return variables[key] || '';
}

// Extend ChatCompletionMessage to include sender
type ExtendedChatCompletionMessage = OpenAI.ChatCompletionMessage & {
    sender?: string;
    tool_calls?: OpenAI.ChatCompletionMessageToolCall[];
    refusal: string | null;
};

type ExtendedDelta = OpenAI.Chat.Completions.ChatCompletionChunk['choices'][0]['delta'] & {
    sender?: string;
};

type ExtendedChatCompletionCreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParams & {
    parallel_tool_calls?: number;
};

export class Swarm {
    private client: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not set in the environment variables');
        }
        this.client = new OpenAI({ apiKey });
    }

    private getSystemMessage(agent: Agent, contextVariables: Record<string, any>): OpenAI.ChatCompletionMessageParam {
        return {
            role: "system",
            content: typeof agent.instructions === 'function'
                ? agent.instructions(contextVariables)
                : agent.instructions
        };
    }

    private async getChatCompletion(
        agent: Agent,
        messages: OpenAI.ChatCompletionMessageParam[],
        contextVariables: ContextVariables,
        modelOverride: string | null,
        stream: boolean,
        debug: boolean
    ): Promise<OpenAI.Chat.Completions.ChatCompletion | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
        // Handle callable instructions
        const instructions = typeof agent.instructions === 'function'
            ? agent.instructions(contextVariables)
            : agent.instructions;

        const systemMessage: OpenAI.ChatCompletionSystemMessageParam = {
            role: "system",
            content: instructions
        };

        debugPrint(debug, "Getting chat completion for:", [systemMessage, ...messages]);

        const tools: OpenAI.ChatCompletionTool[] = agent.functions.map(f => ({
            type: 'function',
            function: {
                name: f.name,
                ...this.functionToJsonSimple(f.function)
            }
        }));

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

    private functionToJsonSimple(func: Function): Partial<FunctionJson['function']> {
        const funcString = func.toString();
        const params = funcString.slice(funcString.indexOf('(') + 1, funcString.indexOf(')')).split(',').map(param => param.trim()).filter(Boolean);
        return {
            name: func.name,
            description: "Function description",
            parameters: {
                type: "object",
                properties: Object.fromEntries(params.map(param => [param, { type: "string" }])),
                required: params
            }
        };
    }

    private isResult(value: any): value is Result {
        return value && typeof value === 'object' && 'value' in value;
    }

    private isAgent(value: any): value is Agent {
        const isAgent = value && typeof value === 'object' && 'name' in value && 'functions' in value;
        console.log(`[DEBUG] isAgent check: ${isAgent}, value:`, value);
        return isAgent;
    }

    private handleFunctionResult(result: any, debug: boolean): Result {
        console.log(`[DEBUG] handleFunctionResult input:`, result);
        switch (true) {
            case this.isResult(result):
                return result;

            case this.isAgent(result):
                console.log(`[DEBUG] Detected agent in function result: ${result.name}`);
                return createResult(
                    JSON.stringify({ assistant: result.name }),
                    undefined,
                    result
                );

            default:
                try {
                    return createResult(String(result));
                } catch (e) {
                    const errorMessage = `Failed to cast response to string: ${result}. Make sure agent functions return a string or Result object. Error: ${e}`;
                    debugPrint(debug, errorMessage);
                    throw new TypeError(errorMessage);
                }
        }
    }

    private async handleToolCalls(
        toolCalls: OpenAI.ChatCompletionMessageToolCall[],
        agent: Agent,
        contextVariables: ContextVariables,
        debug: boolean
    ): Promise<{ messages: OpenAI.ChatCompletionMessageParam[], context_variables: ContextVariables, agent: Agent }> {
        const messages: OpenAI.ChatCompletionMessageParam[] = [];
        let newAgent: Agent | undefined;

        for (const toolCall of toolCalls) {
            console.log(`[DEBUG] Handling tool call: ${toolCall.function.name}`);
            const func = agent.functions.find(f => f.name === toolCall.function.name);
            if (!func) {
                console.error(`Function ${toolCall.function.name} not found`);
                continue;
            }

            const args = JSON.parse(toolCall.function.arguments || '{}');
            const request = getContextVariable(contextVariables, 'request');
            const rawResult = await func.function({ request, ...args });
            const result = this.handleFunctionResult(rawResult, debug);
            console.log(`[DEBUG] Function result:`, result);

            if (this.isAgent(result.value)) {
                newAgent = result.value;
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Transferring to ${newAgent.name}`
                });
                console.log(`[DEBUG] Agent transfer: ${agent.name} -> ${newAgent.name}`);
                break; // Exit the loop after transferring to a new agent
            } else {
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: String(result.value)
                });
            }
        }

        console.log(`[DEBUG] handleToolCalls returning agent: ${(newAgent || agent).name}`);
        return { messages, context_variables: contextVariables, agent: newAgent || agent };
    }

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
                        (delta as ExtendedDelta).sender = activeAgent.name;
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

    private isStreamingCompletion(
        completion: OpenAI.Chat.Completions.ChatCompletion | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
    ): completion is AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
        return Symbol.asyncIterator in completion;
    }
}
