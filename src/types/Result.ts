import { Agent } from './Agent';
import { ContextVariables } from './SharedTypes';

export interface Result {
    value: string;
    agent: Agent | null;
    context_variables: ContextVariables;
}

export const createResult = (
    value: string = "",
    agent: Agent | null = null,
    context_variables: ContextVariables = {}
): Result => ({
    value,
    agent,
    context_variables,
});
