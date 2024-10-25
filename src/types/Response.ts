import { Agent } from './Agent';
import { OpenAI } from 'openai';

export interface Response {
    messages: (OpenAI.ChatCompletionMessageParam | OpenAI.ChatCompletionMessage)[];
    agent: Agent;
    context_variables: Record<string, any>;
}

export const createResponse = (
    messages: (OpenAI.ChatCompletionMessageParam | OpenAI.ChatCompletionMessage)[],
    agent: Agent,
    context_variables: Record<string, any>
): Response => ({
    messages,
    agent,
    context_variables,
});
