import { OpenAI } from 'openai';
import { Task } from '../types/Task';

export interface Engine {
    deploy(client: OpenAI, testMode?: boolean, testFilePath?: string): Promise<void>;
    runTask(task: Task, testMode: boolean): Promise<unknown>;
    loadTestTasks(testFilePath: string): Promise<void>;
}
