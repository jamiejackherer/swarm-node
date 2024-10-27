import { runDemoLoop } from '../src/repl';
import { triageAgent } from './agents';
import dotenv from 'dotenv';
import url from 'url';
import process from 'process';

dotenv.config();

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    runDemoLoop(triageAgent, {}, false, true);  // Set debug to true
}
