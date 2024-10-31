// Define specific error types for transfers
export class TransferError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TransferError';
    }
}

export class InvalidArgumentsError extends TransferError {
    constructor(details: string) {
        super(`Invalid transfer arguments: ${details}`);
        this.name = 'InvalidArgumentsError';
    }
}

export class AssistantNotFoundError extends TransferError {
    constructor(assistantName: string) {
        super(`Target assistant not found: ${assistantName}`);
        this.name = 'AssistantNotFoundError';
    }
}

export class ContextTransferError extends TransferError {
    constructor(details: string) {
        super(`Failed to transfer context: ${details}`);
        this.name = 'ContextTransferError';
    }
}

// New error types needed
export class ThreadError extends TransferError {
    constructor(message: string) {
        super(`Thread error: ${message}`);
        this.name = 'ThreadError';
    }
}

export class MessageError extends TransferError {
    constructor(message: string) {
        super(`Message error: ${message}`);
        this.name = 'MessageError';
    }
} 