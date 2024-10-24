import chalk from 'chalk';
import readline from 'readline';
import { Swarm } from './core';
import { Agent, Response } from './types';

async function processAndPrintStreamingResponse(response: AsyncIterable<any>): Promise<Response> {
    let content = "";
    let lastSender = "";

    for await (const chunk of response) {
        if ("sender" in chunk) {
            lastSender = chunk.sender;
        }

        if ("content" in chunk && chunk.content !== null) {
            if (!content && lastSender) {
                process.stdout.write(chalk.blue(`${lastSender}: `));
                lastSender = "";
            }
            process.stdout.write(chunk.content);
            content += chunk.content;
        }

        if ("tool_calls" in chunk && chunk.tool_calls !== null) {
            for (const toolCall of chunk.tool_calls) {
                const f = toolCall.function;
                const name = f.name;
                if (!name) continue;
                console.log(chalk.blue(`${lastSender}: `) + chalk.magenta(`${name}()`));
            }
        }

        if ("delim" in chunk && chunk.delim === "end" && content) {
            console.log();  // End of response message
            content = "";
        }

        if ("response" in chunk) {
            return chunk.response;
        }
    }

    throw new Error("Stream ended without a response");
}

function prettyPrintMessages(messages: any[]): void {
    for (const message of messages) {
        if (message.role !== "assistant") continue;

        process.stdout.write(chalk.blue(`${message.sender || 'Assistant'}: `));

        if (message.content) {
            console.log(message.content);
        }

        const toolCalls = message.tool_calls || [];
        if (toolCalls.length > 1) {
            console.log();
        }
        for (const toolCall of toolCalls) {
            const f = toolCall.function;
            const { name, arguments: args } = f;
            const argStr = JSON.stringify(JSON.parse(args)).replace(/:/g, "=");
            console.log(chalk.magenta(`${name}(${argStr.slice(1, -1)})`));
        }
    }
}

async function runDemoLoop(
    startingAgent: Agent,
    contextVariables: Record<string, any> = {},
    stream: boolean = false,
    debug: boolean = false
): Promise<void> {
    const client = new Swarm();
    console.log("Starting Swarm CLI 🐝");

    let messages: any[] = [];
    let currentAgent = startingAgent;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    while (true) {
        const userInput = await new Promise<string>(resolve => {
            rl.question(chalk.gray("User: "), resolve);
        });

        messages.push({ role: "user", content: userInput });

        const response = await client.run(
            currentAgent,
            messages,
            contextVariables,
            null,
            stream,
            debug
        );

        if (isResponse(response)) {
            prettyPrintMessages(response.messages);
            messages.push(...response.messages);

            // Check if the agent has changed
            if (response.agent.name !== currentAgent.name) {
                console.log(chalk.yellow(`Agent changed from ${currentAgent.name} to ${response.agent.name}`));
                currentAgent = response.agent;

                // Add a system message to indicate the agent change
                messages.push({
                    role: "system",
                    content: `Switching to ${currentAgent.name}`
                });

                // Get an initial response from the new agent
                const newAgentResponse = await client.run(
                    currentAgent,
                    messages,
                    contextVariables,
                    null,
                    stream,
                    debug
                );

                if (isResponse(newAgentResponse)) {
                    prettyPrintMessages(newAgentResponse.messages);
                    messages.push(...newAgentResponse.messages);
                }
            }

            contextVariables = { ...contextVariables, ...response.context_variables };
        } else {
            console.error("Unexpected response type");
        }

        // Print the current agent's name after each interaction
        console.log(chalk.yellow(`Current Agent: ${currentAgent.name}`));
    }
}

// Type guard for Response
function isResponse(obj: any): obj is Response {
    return obj !== null && typeof obj === 'object' && 'messages' in obj && 'agent' in obj && Array.isArray(obj.messages);
}

// Type guard for AsyncIterable
function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
    return obj !== null && typeof obj === 'object' && Symbol.asyncIterator in obj;
}

export { runDemoLoop };
