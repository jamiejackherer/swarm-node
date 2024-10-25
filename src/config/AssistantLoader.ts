import fs from 'fs/promises';
import { Assistant } from '../Assistant';
import { Tool } from '../types/Tool';

export async function loadAssistantConfig(path: string): Promise<Assistant> {
    const configData = await fs.readFile(path, 'utf-8');
    const config = JSON.parse(configData);
    const tools: Tool[] = config.tools || [];
    return new Assistant(config.name, tools);
}
