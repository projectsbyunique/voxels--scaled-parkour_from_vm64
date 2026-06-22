function hexToNum(c: string): number {
    const code = c.charCodeAt(0);

    // '0'–'9'
    if (code <= 57) return code - 48;

    // 'A'–'F'
    if (code <= 70) return code - 55;

    // 'a'–'f'
    return code - 87;
}

const charToIndex: number[] = []

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.?"
const BASE = chars.length; // 86