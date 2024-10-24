// src/util.ts

import chalk from 'chalk';
import 'reflect-metadata';

/**
 * Debug print function using Chalk for colored output.
 * 
 * @param debug - Flag to enable or disable debugging.
 * @param args - Messages to print.
 */
export function debugPrint(debug: boolean, ...args: any[]): void {
    if (!debug) {
        return;
    }
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const message = args.map(arg => String(arg)).join(' ');

    console.log(
        chalk.white('[') +
        chalk.gray(`${timestamp}`) +
        chalk.white('] ') +
        chalk.gray(`${message}`)
    );
}

/**
 * Recursively merges source into target.
 * 
 * @param target - The target object to merge into.
 * @param source - The source object to merge from.
 */
export function mergeFields(target: Record<string, any>, source: Record<string, any>): void {
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const value = source[key];
            if (typeof value === 'string') {
                if (typeof target[key] === 'string') {
                    target[key] += value;
                } else {
                    target[key] = value;
                }
            } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                if (typeof target[key] !== 'object' || target[key] === null) {
                    target[key] = {};
                }
                mergeFields(target[key], value);
            } else {
                // For other types, overwrite the target's value
                target[key] = value;
            }
        }
    }
}

/**
 * Merges a chunk into the final response, excluding the 'role' key.
 * 
 * @param finalResponse - The final response object to merge into.
 * @param delta - The delta object to merge from.
 */
export function mergeChunk(finalResponse: Record<string, any>, delta: Record<string, any>): void {
    const { role, ...rest } = delta;
    mergeFields(finalResponse, rest);
}

/**
 * Interface representing the JSON structure of a function.
 */
export interface FunctionJson {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: Record<string, { type: string }>;
            required: string[];
        };
    };
}

/**
 * Type mapping from TypeScript types to JSON Schema types.
 */
const typeMap = new Map<Function, string>([
    [String, 'string'],
    [Number, 'number'],
    [Boolean, 'boolean'],
    [Array, 'array'],
    [Object, 'object']
]);

/**
 * Decorator to add metadata to class methods.
 * 
 * @param description - Description of the function.
 */
export function FunctionMetadataDecorator(description: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const paramTypes: any[] = Reflect.getMetadata('design:paramtypes', target, propertyKey) || [];
        const parameterNames = getParamNames(originalMethod);
        const parameters: Record<string, { type: string }> = {};
        const required: string[] = [];

        paramTypes.forEach((type, index) => {
            const paramName = parameterNames[index];
            const typeName = mapType(type);
            parameters[paramName] = { type: typeName };
            required.push(paramName); // Assuming all parameters are required for simplicity
        });

        const metadata: FunctionJson = {
            type: 'function',
            function: {
                name: propertyKey,
                description: description,
                parameters: {
                    type: 'object',
                    properties: parameters,
                    required: required,
                },
            },
        };

        Reflect.defineMetadata('function:json', metadata, originalMethod);
    };
}

/**
 * Helper function to get parameter names from a function.
 * 
 * @param func - The function to extract parameter names from.
 * @returns Array of parameter names.
 */
function getParamNames(func: Function): string[] {
    const fnStr = func.toString().replace(/[/][/].*$/mg, ''); // Remove single-line comments
    const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(/([^\s,]+)/g);
    return result === null ? [] : result;
}

/**
 * Helper function to map TypeScript types to string representations.
 * 
 * @param type - The constructor function of the type.
 * @returns String representation of the type.
 */
function mapType(type: any): string {
    return typeMap.get(type) || 'string'; // Default to string if type is unknown
}

/**
 * Converts a decorated class method into a JSON-serializable object.
 * 
 * @param instance - The instance of the class containing the method.
 * @param methodName - The name of the method to convert.
 * @returns A JSON representation of the function.
 */
export function functionToJson(instance: any, methodName: string): FunctionJson {
    const method = instance[methodName];
    if (!method) {
        throw new Error(`Method ${methodName} does not exist on the provided instance.`);
    }

    const metadata: FunctionJson | undefined = Reflect.getMetadata('function:json', method);
    if (!metadata) {
        throw new Error(`No metadata found for method ${methodName}. Ensure it is decorated with @FunctionMetadataDecorator.`);
    }

    return metadata;
}
