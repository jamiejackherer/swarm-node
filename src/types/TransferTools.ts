import { FunctionParameters } from './Tool';
import { TransferResponse } from './Transfer';
import { HistoryItem } from './History';
import { InvalidArgumentsError, TransferError } from './TransferError';

// Define the expected arguments for transfer functions
export interface TransferFunctionArgs {
    request: string;
    context?: {
        history: HistoryItem[];
    };
}

// Define the transfer tool interface
export interface TransferTool {
    name: string;
    description: string;
    parameters: FunctionParameters;
    function: (args: unknown) => Promise<TransferResponse>;
}

// Parameter schema for transfer functions
export const TransferFunctionParameters: FunctionParameters = {
    type: 'object',
    properties: {
        request: {
            type: 'string',
            description: 'The user request to be transferred'
        },
        context: {
            type: 'object',
            description: 'Additional context for the transfer'
        }
    },
    required: ['request']
};

// Helper function to validate history item with detailed error
function validateHistoryItem(value: unknown, index: number): asserts value is HistoryItem {
    if (!value || typeof value !== 'object') {
        throw new InvalidArgumentsError(`History item at index ${index} must be an object`);
    }

    const candidate = value as Record<string, unknown>;

    if (typeof candidate.role !== 'string') {
        throw new InvalidArgumentsError(`History item at index ${index} must have a string 'role'`);
    }

    if (typeof candidate.content !== 'string') {
        throw new InvalidArgumentsError(`History item at index ${index} must have a string 'content'`);
    }
}

// Helper function to validate transfer args with detailed errors
export function validateTransferArgs(value: unknown): asserts value is TransferFunctionArgs {
    if (!value || typeof value !== 'object') {
        throw new InvalidArgumentsError('Arguments must be an object');
    }

    const candidate = value as Record<string, unknown>;

    if (typeof candidate.request !== 'string') {
        throw new InvalidArgumentsError('Request must be a string');
    }

    if (candidate.context) {
        if (!Array.isArray((candidate.context as Record<string, unknown>).history)) {
            throw new InvalidArgumentsError('Context history must be an array');
        }

        ((candidate.context as Record<string, unknown>).history as unknown[]).forEach(
            (item: unknown, index: number) => validateHistoryItem(item, index)
        );
    }
}

// Helper function to create a transfer tool
export function createTransferTool(
    name: string,
    description: string,
    targetAssistant: string
): TransferTool {
    return {
        name,
        description,
        parameters: TransferFunctionParameters,
        function: async (args: unknown): Promise<TransferResponse> => {
            try {
                validateTransferArgs(args);

                return {
                    action: 'transfer',
                    assistant: targetAssistant,
                    context: {
                        request: args.request,
                        history: args.context?.history || []
                    }
                };
            } catch (error) {
                if (error instanceof TransferError) {
                    throw error;
                }
                throw new TransferError(`Unexpected error during transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };
} 