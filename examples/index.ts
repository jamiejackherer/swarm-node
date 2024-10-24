import { runDemoLoop } from '../src/repl';
import { triageAgent } from './agents';
import dotenv from 'dotenv';

dotenv.config();

if (require.main === module) {
    runDemoLoop(triageAgent, {}, false, true);  // Set debug to true
}
