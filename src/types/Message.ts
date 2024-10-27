import { ChatCompletionMessageParam, ChatCompletionAssistantMessageParam } from 'openai/resources/chat';

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
    content: string;
    sender?: string;
    task_id?: string;  // Add this field
    tool?: {
        tool: string;
        args: Record<string, unknown>;
    };
    refusal?: string | null;
}

export function convertToChatMessage(message: Message): ChatCompletionMessageParam {
    if (message.tool) {
        const assistantMessage: ChatCompletionAssistantMessageParam = {
            role: 'assistant',
            content: message.content,
            tool_calls: [{
                id: 'call_' + Date.now(),
                type: 'function',
                function: {
                    name: message.tool.tool,
                    arguments: JSON.stringify(message.tool.args)
                }
            }]
        };
        return assistantMessage;
    }

    if (message.role === 'function') {
        return {
            role: 'function',
            content: message.content,
            name: 'unknown' // Required for function messages
        };
    }

    if (message.role === 'tool') {
        return {
            role: 'tool',
            content: message.content,
            tool_call_id: 'unknown' // Required for tool messages
        };
    }

    return {
        role: message.role,
        content: message.content,
        name: message.sender
    } as ChatCompletionMessageParam;
}

export function convertFromChatMessage(message: ChatCompletionMessageParam): Message {
    if (message.role === 'function') {
        throw new Error('Function messages not supported');
    }

    const baseMessage: Message = {
        role: message.role,
        content: typeof message.content === 'string' ? message.content : '',
        sender: 'name' in message ? message.name : undefined,
        refusal: 'refusal' in message ? message.refusal : null
    };

    if ('tool_calls' in message && message.tool_calls?.[0]) {
        baseMessage.tool = {
            tool: message.tool_calls[0].function.name,
            args: JSON.parse(message.tool_calls[0].function.arguments)
        };
    }

    return baseMessage;
}
