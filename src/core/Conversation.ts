export class Conversation {
    private history: unknown[] = [];  // Stores all messages, tool calls, and outputs
    private currentMessages: unknown[] = [];  // Stores messages of the current interaction
    private summary: string | null = null;

    constructor() { }

    addToolCall(toolCall: unknown): void {
        this.history.push(toolCall);
    }

    addOutput(output: unknown): void {
        this.history.push(output);
    }

    summarize(): void {
        // Implement summarization logic here
        // Could use LLM to generate summary
        this.summary = "Summary of the conversation";
    }

    getSummary(): string {
        if (!this.summary) {
            this.summarize();
        }
        return this.summary || '';
    }

    clearCurrentMessages(): void {
        this.currentMessages = [];
    }

    toString(): string {
        return `Conversation(History: ${this.history.length}, Current Messages: ${this.currentMessages.length}, Summary: ${this.summary})`;
    }
}
