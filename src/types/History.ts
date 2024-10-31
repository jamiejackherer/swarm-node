// Types for conversation history
export interface HistoryItem {
    role: string;
    content: string;
}

export interface TransferContext {
    history: HistoryItem[];
} 