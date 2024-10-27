import { OpenAI } from 'openai';

export type ExtendedChatCompletionCreateParams = Omit<OpenAI.ChatCompletionCreateParams, 'parallel_tool_calls'> & {
    parallel_tool_calls?: number;
};
/**
 * Extended type for ChatCompletionMessage to include sender and additional properties.
 */
export type ExtendedChatCompletionMessage = OpenAI.ChatCompletionMessage & {
    sender?: string;
    tool_calls?: OpenAI.ChatCompletionMessageToolCall[];
    refusal: string | null;
};

/**
 * Extended type for ChatCompletionChunk delta to include sender.
 */
// type ExtendedDelta = OpenAI.Chat.Completions.ChatCompletionChunk['choices'][0]['delta'] & {
//     sender?: string;
// };