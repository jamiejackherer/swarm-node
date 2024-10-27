import { runDemoLoop } from '../../src/repl';
import { triageAssistant } from './assistants';
import dotenv from 'dotenv';
import url from 'url';
import process from 'process';

dotenv.config();

// Initialize OpenAI client and engine in the demo loop
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    // Use triageAssistant as the main entry point, similar to how agents demo uses triageAgent
    runDemoLoop(triageAssistant, {}, false, true, 'assistants');
}
