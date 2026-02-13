/**
 * Type definitions for Deno globals (Supabase Edge Functions)
 * This allows TypeScript to recognize 'Deno' in the frontend project.
 */
declare namespace Deno {
    export interface Env {
        get(key: string): string | undefined;
        set(key: string, value: string): void;
        delete(key: string): void;
        toObject(): { [key: string]: string };
    }

    export const env: Env;

    export interface FileInfo {
        size: number;
        mtime: Date | null;
        atime: Date | null;
        birthtime: Date | null;
        dev: number;
        ino: number | null;
        mode: number | null;
        nlink: number | null;
        uid: number | null;
        gid: number | null;
        rdev: number | null;
        blksize: number | null;
        blocks: number | null;
        isBlockDevice: boolean | null;
        isCharacterDevice: boolean | null;
        isDirectory: boolean;
        isFifo: boolean | null;
        isFile: boolean;
        isSocket: boolean | null;
        isSymlink: boolean;
    }
}

// Ensure crypto.randomUUID is recognized if not already in the environment
interface Crypto {
    randomUUID(): string;
}
