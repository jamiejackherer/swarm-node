export function format(str: string, ...args: unknown[]): string {
    return str.replace(/{}/g, () => String(args.shift()));
}
