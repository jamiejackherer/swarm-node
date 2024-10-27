import { Agent } from './Agent';
import { OpenAI } from 'openai';

export interface Response<T = unknown> {
    messages: (OpenAI.ChatCompletionMessageParam | OpenAI.ChatCompletionMessage)[];
    agent: Agent;
    context_variables: Record<string, T>;
}

export const createResponse = <T = unknown>(
    messages: (OpenAI.ChatCompletionMessageParam | OpenAI.ChatCompletionMessage)[],
    agent: Agent,
    context_variables: Record<string, T> = {}
): Response<T> => ({
    messages,
    agent,
    context_variables,
});
