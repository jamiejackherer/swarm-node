import { runDemoLoop } from '../../src/repl';
import { triageAssistant, salesAssistant, refundsAssistant } from './assistants';
import { OpenAI } from 'openai';
import { AssistantsEngine } from '../../src/engines/AssistantsEngine';
import { Task } from '../../src/types/Task';
import dotenv from 'dotenv';
import url from 'url';
import process from 'process';

dotenv.config();

// Initialize OpenAI client and engine in the demo loop
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required');
    }

    // Initialize OpenAI client
    const client = new OpenAI({ apiKey });

    // Create tasks for each assistant
    const tasks = [
        new Task({
            description: 'Handle initial user requests and route to appropriate assistant',
            assistant: triageAssistant.name,
            iterate: false
        }),
        new Task({
            description: 'Handle sales-related inquiries',
            assistant: salesAssistant.name,
            iterate: false
        }),
        new Task({
            description: 'Handle refund-related inquiries',
            assistant: refundsAssistant.name,
            iterate: false
        })
    ];

    // Create engine with tasks
    const engine = new AssistantsEngine(client, tasks);

    // IIFE to handle async deployment
    (async () => {
        await engine.deploy(client);
        // Start the demo loop after deployment
        runDemoLoop(triageAssistant, {}, false, true, 'assistants', engine);
    })();
}
