import { Agent } from './Agent';

export interface Result {
    value: string;
    agent: Agent | null;
    context_variables: Record<string, any>;
}

export const createResult = (
    value: string = "",
    agent: Agent | null = null,
    context_variables: Record<string, any> = {}
): Result => ({
    value,
    agent,
    context_variables,
});
