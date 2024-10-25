import chalk from 'chalk';

/**
 * Debug print function using Chalk for colored output.
 * 
 * @param debug - Flag to enable or disable debugging.
 * @param args - Messages to print.
 */
export function debugPrint(debug: boolean, ...args: any[]): void {
    if (debug) {
        console.log(...args);
    }
}
