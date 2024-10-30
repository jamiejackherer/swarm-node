export interface TransferResponse {
    action: 'transfer';
    assistant: string;
    context: {
        request: string;
        history: Array<{ role: string; content: string; }>;
    };
}

export function isTransferResponse(obj: unknown): obj is TransferResponse {
    if (typeof obj !== 'object' || obj === null) return false;

    const response = obj as Record<string, unknown>;

    return (
        response.action === 'transfer' &&
        typeof response.assistant === 'string' &&
        typeof response.context === 'object' &&
        response.context !== null &&
        typeof (response.context as any).request === 'string' &&
        Array.isArray((response.context as any).history) &&
        (response.context as any).history.every((item: any) =>
            typeof item === 'object' &&
            typeof item.role === 'string' &&
            typeof item.content === 'string'
        )
    );
} 