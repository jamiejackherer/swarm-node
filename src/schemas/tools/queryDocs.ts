export const queryDocsSchema = {
    name: "query_docs",
    description: "Tool to get information about OpenAI products to help users. This JUST queries the data, it does not respond to user.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "A detailed description of what the user wants to know."
            }
        },
        required: ["query"]
    }
} as const;
