export * from './Agent';
export * from './Response';
export * from './Result';
export * from './Tool';
export * from './ToolCall';

export type AgentFunction = (...args: any[]) => Promise<any>;
