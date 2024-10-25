import 'reflect-metadata';

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
 * @param func - The function to convert.
 * @returns A JSON representation of the function.
 */
export function functionToJson(func: Function): FunctionJson {
    const metadata: FunctionJson | undefined = Reflect.getMetadata('function:json', func);
    if (!metadata) {
        throw new Error(`No metadata found for method ${func.name}. Ensure it is decorated with @FunctionMetadataDecorator.`);
    }

    return metadata;
}
