export interface Parameter {
    type: string;
    description?: string;
    enum?: string[];
}

export interface FunctionParameters {
    type: 'object';
    properties: Record<string, Parameter>;
    required?: string[];
}

export interface FunctionTool {
    name: string;
    description?: string;
    parameters: FunctionParameters;
}

export interface Tool {
    name: string;
    function: (...args: unknown[]) => Promise<unknown>;
}
