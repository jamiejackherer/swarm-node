export interface ToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
    type: string;
}
