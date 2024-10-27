// Import URL for ESM
import { Assistant } from '../../src/agents/Assistant';
import { Tool } from '../../src/types/Tool';
import { Message } from '../../src/types/Message';
import console from 'console';

// Mock functions with proper typing for Tool interface
const processRefund: Tool['function'] = async (...args: unknown[]) => {
    const itemId = String(args[0] || '');
    const reason = String(args[1] || 'NOT SPECIFIED');
    console.log(`[mock] Refunding item ${itemId} because ${reason}...`);
    return "Success!";
};

const applyDiscount: Tool['function'] = async () => {
    console.log("[mock] Applying discount...");
    return "Applied discount of 11%";
};

const checkInventory: Tool['function'] = async () => {
    console.log("[mock] Checking inventory...");
    return "Inventory checked";
};

const processSale: Tool['function'] = async (...args: unknown[]) => {
    const itemId = String(args[0] || '');
    const quantity = Number(args[1] || 1);
    console.log(`[mock] Processing sale for ${quantity} of item ${itemId}...`);
    return `Sale processed for ${quantity} of item ${itemId}`;
};

// Define tools with proper typing
const triageTools: Tool[] = [
    {
        name: "transferToSales",
        function: async (...args: unknown[]) => {
            const request = String(args[0] || '');
            console.log("[mock] Transferring to Sales Assistant with request:", request);
            return salesAssistant;
        }
    },
    {
        name: "transferToRefunds",
        function: async (...args: unknown[]) => {
            const request = String(args[0] || '');
            console.log("[mock] Transferring to Refunds Assistant with request:", request);
            return refundsAssistant;
        }
    }
];

const salesTools: Tool[] = [
    {
        name: "checkInventory",
        function: checkInventory
    },
    {
        name: "processSale",
        function: processSale
    }
];

const refundTools: Tool[] = [
    {
        name: "processRefund",
        function: processRefund
    },
    {
        name: "applyDiscount",
        function: applyDiscount
    }
];

// Define message types properly
const triageMessage: Message = {
    role: 'system',
    content: "Determine which assistant is best suited to handle the user's request..."
};

const salesMessage: Message = {
    role: 'system',
    content: "Assist customers with sales and purchase requests..."
};

const refundsMessage: Message = {
    role: 'system',
    content: "Assist customers with refund and return requests..."
};

// Create assistants with proper typing
const triageAssistant = new Assistant(
    "Triage Assistant",
    triageTools,
    {
        history: [triageMessage]
    }
);

const salesAssistant = new Assistant(
    "Sales Assistant",
    salesTools,
    {
        history: [salesMessage]
    }
);

const refundsAssistant = new Assistant(
    "Refunds Assistant",
    refundTools,
    {
        history: [refundsMessage]
    }
);

// Export the assistants
export { triageAssistant, salesAssistant, refundsAssistant };
