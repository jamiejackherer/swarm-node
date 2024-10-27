import OpenAI from 'openai';
import { Tool } from '../types/Tool';
import { getCompletion } from '../utils/openai';
import { LOCAL_PLANNER_PROMPT } from '../config/prompts';

export async function generatePlan(client: OpenAI, tools: Tool[], task: string): Promise<unknown> {
    const prompt = LOCAL_PLANNER_PROMPT.replace('{tools}', JSON.stringify(tools)).replace('{task}', task);
    const response = await getCompletion(client, [{ role: 'user', content: prompt }]);
    // Parse and return the plan
    return response; // This would be adjusted based on the actual response structure
}
