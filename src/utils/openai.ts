import OpenAI from 'openai';

/**
 * Sends a request to the OpenAI API to get a chat completion.
 * 
 * @param client - The OpenAI client instance.
 * @param messages - An array of messages for the conversation.
 * @param model - The model to use for the completion (default: "gpt-4-0125-preview").
 * @returns A Promise that resolves to the chat completion response.
 */
export async function getCompletion(
    client: OpenAI,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    model: string = "gpt-4-0125-preview"
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const response = await client.chat.completions.create({
        model: model,
        messages: messages,
    });
    return response;
}
