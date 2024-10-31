// Import URL for ESM
import { Assistant } from '../../src/agents/Assistant';
import { Tool } from '../../src/types/Tool';
import { queryDocs } from '../../src/tools/queryDocs';
import { QueryParamsSchema } from '../../src/types/QueryParams';
import { createTransferTool } from '../../src/types/TransferTools';

function isQueryParams(obj: unknown): obj is QueryParamsSchema {
    if (typeof obj !== 'object' || obj === null) return false;

    const params = obj as Record<string, unknown>;

    // Check required properties
    if (!('query' in params)) return false;
    if (typeof params.query !== 'string') return false;

    // Check optional properties
    if ('collection' in params && typeof params.collection !== 'string') return false;

    return true;
}
// Define tools with proper typing
const triageTools: Tool[] = [
    {
        name: "query_docs",
        function: async (...args: unknown[]): Promise<unknown> => {
            const params = args[0];
            if (!isQueryParams(params)) {
                return { response: 'Invalid query parameters.' };
            }
            return queryDocs.function({ ...params, collection: 'triage' });  // Remove extra array
        }
    }
];

const salesTools: Tool[] = [
    {
        name: "query_docs",
        function: async (...args: unknown[]): Promise<unknown> => {
            const params = args[0];
            if (!isQueryParams(params)) {
                return { response: 'Invalid query parameters.' };
            }
            return queryDocs.function({ ...params, collection: 'sales' });   // Remove extra array
        }
    }
];

const refundsTools: Tool[] = [
    {
        name: "query_docs",
        function: async (...args: unknown[]): Promise<unknown> => {
            const params = args[0];
            if (!isQueryParams(params)) {
                return { response: 'Invalid query parameters.' };
            }
            return queryDocs.function({ ...params, collection: 'refunds' }); // Remove extra array
        }
    }
];

// Define assistants first to avoid circular references
const triageAssistant = new Assistant(
    "Triage Assistant",
    triageTools,
    {
        history: [{
            role: 'system',
            content: `You are a helpful assistant that specializes in routing user queries to the appropriate department.
When users ask questions, ALWAYS use the query_docs tool first to find relevant information in our documentation.
Then, based on the query and documentation:
1. For questions about pricing, products, making purchases, or when users explicitly request sales → use transferToSales function
2. For questions about refunds or returns → use transferToRefunds function
3. For general inquiries → handle them yourself using the documentation

IMPORTANT: Always use the query_docs tool before responding to ensure you have the latest information.`
        }]
    }
);

const salesAssistant = new Assistant(
    "Sales Assistant",
    salesTools,
    {
        history: [{
            role: 'system',
            content: `You are a sales assistant that helps users with purchasing products.
ALWAYS use the query_docs tool first to find specific pricing and product information.
Focus on:
1. Understanding customer needs
2. Providing accurate pricing information
3. Explaining product features and benefits
4. Helping customers choose the right plan

IMPORTANT: Always use the query_docs tool before responding to ensure you have the latest product information.`
        }]
    }
);

const refundsAssistant = new Assistant(
    "Refunds Assistant",
    refundsTools,
    {
        history: [{
            role: 'system',
            content: `You are a refunds assistant that helps users with refund requests.
ALWAYS use the query_docs tool first to find specific refund policy information.
Focus on:
1. Explaining refund policies and timeframes
2. Guiding users through the refund process
3. Setting correct expectations about processing times
4. Providing accurate policy information

IMPORTANT: Always use the query_docs tool before responding to ensure you have the latest refund information.`
        }]
    }
);

// Then define transfer functions with proper signatures
const transferFunctions: Record<string, Tool> = {
    transferToSales: createTransferTool(
        "transferToSales",
        "Transfer the conversation to the Sales Assistant",
        "Sales Assistant"
    ),
    transferToRefunds: createTransferTool(
        "transferToRefunds",
        "Transfer the conversation to the Refunds Assistant",
        "Refunds Assistant"
    ),
    transferBackToTriage: createTransferTool(
        "transferBackToTriage",
        "Transfer the conversation back to the Triage Assistant",
        "Triage Assistant"
    )
};

// Add transfer functions to assistants
triageAssistant.functions = [
    {
        name: "transferToSales",
        function: transferFunctions.transferToSales.function
    },
    {
        name: "transferToRefunds",
        function: transferFunctions.transferToRefunds.function
    }
];

salesAssistant.functions = [
    {
        name: "transferBackToTriage",
        function: transferFunctions.transferBackToTriage.function
    }
];

refundsAssistant.functions = [
    {
        name: "transferBackToTriage",
        function: transferFunctions.transferBackToTriage.function
    },
    {
        name: "transferToSales",
        function: transferFunctions.transferToSales.function
    }
];

export { triageAssistant, salesAssistant, refundsAssistant };
