import { Agent } from '../src/types'; // Adjust the import path as necessary
import { Swarm } from '../src/core'; // Import the Swarm class

// Mock functions to simulate agent actions
function processRefund(itemId: string, reason: string = "NOT SPECIFIED"): Promise<string> {
    console.log(`[mock] Refunding item ${itemId} because ${reason}...`);
    return Promise.resolve("Success!");
}

function applyDiscount(): Promise<string> {
    console.log("[mock] Applying discount...");
    return Promise.resolve("Applied discount of 11%");
}

function completeRefundAndTransferBack(): Promise<Agent> {
    console.log("[mock] Completing refund and transferring back to Triage Agent");
    return Promise.resolve(triageAgent);
}

function completeSaleAndTransferBack(): Promise<Agent> {
    console.log("[mock] Completing sale and transferring back to Triage Agent");
    return Promise.resolve(triageAgent);
}


function checkInventory(): Promise<string> {
    console.log("[mock] Checking inventory...");
    return Promise.resolve("Inventory checked");
}

function processSale(itemId: string, quantity: number): Promise<string> {
    console.log(`[mock] Processing sale for ${quantity} of item ${itemId}...`);
    return Promise.resolve(`Sale processed for ${quantity} of item ${itemId}`);
}

// Define agents
export const triageAgent: Agent = {
    name: "Triage Agent",
    instructions: "Determine which agent is best suited to handle the user's request. If the user mentions refunds or returns, transfer to the Refunds Agent. If the user wants to buy bees or asks about products, transfer to the Sales Agent. Only transfer to one agent, not both. When transferring, pass the user's full request as context.",
    model: "gpt-3.5-turbo",
    functions: [
        {
            name: "transferToSales",
            function: (context: { request: string }) => transferToSales({ request: context.request })
        },
        {
            name: "transferToRefunds",
            function: (context: { request: string }) => transferToRefunds({ request: context.request })
        }
    ]
};

export const salesAgent: Agent = {
    name: "Sales Agent",
    instructions: (context) => `Assist customers with sales and purchase requests based on their original request. Offer solutions or forward inquiries appropriately based on the customer's reason for their request.

Customers original request: "${context.request}"

Be an enthusiastic sales agent excited about selling bees. Engage the user with upbeat and positive energy. 

# Steps

- Greet the user warmly and introduce the bees with excitement.
- Highlight the benefits and unique qualities of the bees you're selling.
- Encourage questions about the bees and provide positive, persuasive responses.
- If the user inquires about refunds or returns, inform them that you will transfer them to the refunds agent.
- For any other questions or concerns, notify the user that you will transfer them back to a triage agent for further assistance.

# Output Format

- Communication must be in the form of enthusiastic dialogue, ensuring that the user feels your excitement.
- Keep the conversation friendly and engaging, steering the direction towards the benefits of owning the bees.
- When necessary to transfer, clearly indicate the intention to transfer and which agent they will be connected to.

# Examples

**Example 1:**

*User*: "Tell me more about these bees!"

*Agent*: "Oh, I'm thrilled you asked! Our bees are simply the best! They come from a long line of the finest pollinators and produce the sweetest honey you’ll ever taste! You’re going to love them!"

**Example 2:**

*User*: "What’s your refund policy?"

*Agent*: "Great question! I'll transfer you to our refunds agent who can help you with that specifically. They're wonderful at handling these queries!" 

(Note: Real conversations are longer and may contain more back-and-forth, with specific questions and detailed responses using placeholders for the type of bees, benefits, etc.)`,
    model: "gpt-3.5-turbo",
    functions: []
};

export const refundsAgent: Agent = {
    name: "Refunds Agent",
    instructions: (context) => `Assist customers with refund and return requests based on their original request. Offer solutions or forward inquiries appropriately based on the customer's reason for their request.

Customers original request: "${context.request}"

# Initial Response
Begin by acknowledging the customer's request for a refund or return. Use the information provided in their original request to tailor your response. Do not ask for information that has already been provided.

# Steps
1. **Identify Reason for Refund/Return:**
   - Use the reason from the customer's original request.
   - If the reason is unclear, politely ask for clarification.

2. **Determine Appropriate Action:**
   - If the product was too expensive, offer a discount code.
   - If a refund is insisted upon, initiate the refund process.
   - For queries about purchases, prepare to transfer back to the Triage Agent.

# Output Format

Respond to the customer in a polite and professional manner, ensuring clarity and conciseness. Use complete sentences and provide a clear explanation of the next steps based on the customer's needs.

# Examples

**Example 1:**
- **Input:** "[ORIGINAL REQUEST: The item is too pricey for me. Can I get a refund?]"
- **Output:** "I understand that the price may have been a concern. As an alternative to a refund, I can offer you a discount code for a future purchase. If you still prefer a refund, please let me know, and I'll process it for you."

**Example 2:**
- **Input:** "[ORIGINAL REQUEST: I want to return this item and buy something else instead.]"
- **Output:** "I appreciate your interest in our products. To assist you with purchases, I'll transfer you back to our Triage Agent for assistance. Please hold on for a moment."

# Notes

- Ensure empathy and understanding in every response to enhance the customer experience.
- Offer solutions or alternatives before processing returns to minimize unnecessary refunds.
- Follow company policies strictly when issuing refunds or discounts.`,
    model: "gpt-3.5-turbo",
    functions: [
        { name: "processRefund", function: processRefund },
        { name: "applyDiscount", function: applyDiscount }
    ]
};
// Transfer functions
function transferBackToTriage(context: { request: string }): Promise<Agent> {
    console.log("[mock] Transferring back to Triage Agent with context:", context);
    triageAgent.context = context; // Store context in the Triage Agent
    return Promise.resolve(triageAgent);
}

function transferToSales(context: { request: string }): Promise<Agent> {
    console.log("[mock] Transferring to Sales Agent with context:", context);
    salesAgent.context = context; // Store context in the Sales Agent
    return Promise.resolve(salesAgent);
}

function transferToRefunds(context: { request: string }): Promise<Agent> {
    console.log("[mock] Transferring to Refunds Agent with context:", context);
    refundsAgent.context = context; // Store context in the Refunds Agent
    return Promise.resolve(refundsAgent);
}

// Assign functions to agents
triageAgent.functions = [
    { name: "transferToSales", function: (context: { request: string }) => transferToSales({ request: context.request }) },
    { name: "transferToRefunds", function: (context: { request: string }) => transferToRefunds({ request: context.request }) }
];

salesAgent.functions.push(
    { name: "transferBackToTriage", function: (context: { request: string }) => transferBackToTriage({ request: context.request }) },
    { name: "completeSaleAndTransferBack", function: completeSaleAndTransferBack },
    { name: "checkInventory", function: checkInventory },
    { name: "processSale", function: processSale } // New function to process sales
);

refundsAgent.functions.push(
    { name: "transferBackToTriage", function: (context: { request: string }) => transferBackToTriage({ request: context.request }) },
    { name: "completeRefundAndTransferBack", function: completeRefundAndTransferBack },
    { name: "transferToSales", function: (context: { request: string }) => transferToSales({ request: context.request }) }
);

