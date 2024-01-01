import { IMoodleRelease } from './interfaces';

export const parseMoodleVersion = (release?: string): IMoodleRelease => {
    const version = release?.split(' ')[0];
    const [major, minor, patch] = (version || '').split('.').map((v) => parseInt(v, 10));
    if (typeof major !== 'number' || typeof minor !== 'number' || typeof patch !== 'number') {
        return { major: 0, minor: 0, patch: 0 };
    }
    return { major, minor, patch };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debounce = (func: (...args: any[]) => void, wait = 0): ((...args: any[]) => void) => {
    let timer: ReturnType<typeof setTimeout>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: any[]): void => {
        clearTimeout(timer);
        timer = setTimeout(func, wait, ...args);
    };
};
