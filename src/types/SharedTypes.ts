export type InstructionsFunction = (contextVariables: Record<string, string>) => Promise<string>;

export type AgentFunction = (...args: unknown[]) => unknown;

export type ContextVariables = Record<string, string>;