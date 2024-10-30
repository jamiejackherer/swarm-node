import chalk from 'chalk';
import readline from 'readline';
import { Swarm } from './core';
import { Agent, ContextVariables, Response, Task } from './types';
import console from 'console';
import process from 'process';
import { AssistantsEngine } from './engines/AssistantsEngine';
import { OpenAI } from 'openai';
import { Assistant } from './agents/Assistant';
import { Message, convertToChatMessage, convertFromChatMessage } from './types/Message';

/**
 * Pretty prints the messages from the AI response.
 * @param messages - The messages to print.
 */
function prettyPrintMessages(messages: Message[]): void {
    for (const message of messages) {
        if (message.role !== "assistant") continue;

        process.stdout.write(chalk.blue(`${message.sender || 'Assistant'}: `));

        if (message.content) {
            console.log(message.content);
        }

        if (message.tool) {
            const argStr = JSON.stringify(message.tool.args).replace(/:/g, "=");
            console.log(chalk.magenta(`${message.tool.tool}(${argStr.slice(1, -1)})`));
        }
    }
}

/**
 * Runs the demo loop for the Swarm CLI.
 */
async function runDemoLoop(
    startingAgent: Agent | Assistant,
    contextVariables: ContextVariables = {},
    stream: boolean = false,
    debug: boolean = false,
    engineType: 'swarm' | 'assistants' = 'swarm',
    existingEngine?: AssistantsEngine
): Promise<void> {
    const swarmClient = engineType === 'swarm' ? new Swarm() : null;
    const openAIClient = engineType === 'assistants' && !existingEngine ? new OpenAI() : null;
    const engine = existingEngine || (engineType === 'assistants' && openAIClient ?
        new AssistantsEngine(openAIClient, []) : null);

    console.log(`Starting ${engineType === 'swarm' ? 'Swarm' : 'Assistants'} CLI 🐝`);

    let messages: Message[] = [];
    let currentAgent = startingAgent;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    while (true) {
        const userInput = await new Promise<string>(resolve => {
            rl.question(chalk.gray("User: "), resolve);
        });

        if (engineType === 'assistants' && engine && currentAgent) {
            const taskConfig = {
                description: userInput,
                assistant: currentAgent.name,
                evaluate: false,
                iterate: false
            };
            const task = new Task(taskConfig);

            try {
                const response = await engine.runTask(task, debug);
                console.log(chalk.blue(`Assistant: ${response}`));
            } catch (error) {
                console.error('Error:', error);
            }
        } else if (swarmClient && isAgent(currentAgent)) {
            const userMessage: Message = {
                role: 'user',
                content: userInput
            };
            messages.push(userMessage);

            const chatMessages = messages.map(convertToChatMessage);

            const response = await swarmClient.run(
                currentAgent,
                chatMessages,
                contextVariables,
                null,
                stream,
                debug
            );

            if (isSwarmResponse(response)) {
                const swarmMessages = response.messages.map(convertFromChatMessage);
                prettyPrintMessages(swarmMessages);
                messages = [...messages, ...swarmMessages];

                if (response.agent.name !== currentAgent.name) {
                    console.log(chalk.yellow(`Agent changed from ${currentAgent.name} to ${response.agent.name}`));
                    currentAgent = response.agent;

                    const systemMessage: Message = {
                        role: 'system',
                        content: `Switching to ${currentAgent.name}`
                    };
                    messages.push(systemMessage);

                    if (isAgent(currentAgent)) {
                        const newAgentResponse = await swarmClient.run(
                            currentAgent,
                            messages.map(convertToChatMessage),
                            contextVariables,
                            null,
                            stream,
                            debug
                        );

                        if (isSwarmResponse(newAgentResponse)) {
                            const newMessages = newAgentResponse.messages.map(convertFromChatMessage);
                            prettyPrintMessages(newMessages);
                            messages = [...messages, ...newMessages];
                        }
                    }
                }

                contextVariables = { ...contextVariables, ...response.context_variables };
            }
        }

        console.log(chalk.yellow(`Current Agent: ${currentAgent.name}`));
    }
}

interface SwarmResponse extends Omit<Response<unknown>, 'messages'> {
    messages: Message[];
    agent: Agent;
    context_variables: ContextVariables;
}

function isValidMessage(obj: unknown): obj is Message {
    const message = obj as Record<string, unknown>;

    const hasValidRole = typeof message?.role === 'string' &&
        ['system', 'user', 'assistant', 'function', 'tool'].includes(message.role);

    const hasValidContent = typeof message?.content === 'string';

    const hasValidOptionals = (
        message?.sender === undefined || typeof message.sender === 'string'
    ) && (
            message?.task_id === undefined || typeof message.task_id === 'string'
        ) && (
            message?.refusal === undefined ||
            message?.refusal === null ||
            typeof message.refusal === 'string'
        );

    const hasValidTool = message?.tool === undefined || (
        typeof message.tool === 'object' &&
        message.tool !== null &&
        typeof (message.tool as Record<string, unknown>).tool === 'string' &&
        typeof (message.tool as Record<string, unknown>).args === 'object' &&
        (message.tool as Record<string, unknown>).args !== null
    );

    return !!message && hasValidRole && hasValidContent && hasValidOptionals && hasValidTool;
}

function isValidAgent(obj: unknown): obj is Agent {
    const agent = obj as Record<string, unknown>;

    const hasValidBasics = typeof agent?.name === 'string' &&
        typeof agent?.model === 'string';

    const hasValidInstructions = typeof agent?.instructions === 'string' ||
        typeof agent?.instructions === 'function';

    const hasValidFunctions = Array.isArray(agent?.functions) &&
        agent.functions.every(f =>
            typeof f === 'object' &&
            f !== null &&
            typeof (f as Record<string, unknown>).name === 'string' &&
            typeof (f as Record<string, unknown>).function === 'function'
        );

    return !!agent && hasValidBasics && hasValidInstructions && hasValidFunctions;
}

function isAgent(value: Agent | Assistant): value is Agent {
    return !(value instanceof Assistant) && isValidAgent(value);
}

function isSwarmResponse(obj: unknown): obj is SwarmResponse {
    const response = obj as Record<string, unknown>;

    if (!response || typeof response !== 'object') {
        return false;
    }

    const hasValidMessages = Array.isArray(response.messages) &&
        response.messages.every(isValidMessage);

    const hasValidAgent = response.agent !== undefined &&
        isValidAgent(response.agent);

    const hasValidContextVars = response.context_variables !== undefined &&
        typeof response.context_variables === 'object' &&
        response.context_variables !== null;

    return hasValidMessages && hasValidAgent && hasValidContextVars;
}

export { runDemoLoop };
