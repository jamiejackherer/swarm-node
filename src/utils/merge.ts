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
