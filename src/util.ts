import { IMoodleRelease } from './interfaces';

export const parseMoodleVersion = (release?: string): IMoodleRelease => {
    const version = release?.split(' ')[0];
    const [major, minor, patch] = (version || '').split('.').map((v) => parseInt(v, 10));
    // parseInt yields NaN for non-numeric parts and missing parts are undefined;
    // default each field independently so a 2-part release (e.g. "4.2") keeps major/minor.
    return {
        major: Number.isFinite(major) ? major : 0,
        minor: Number.isFinite(minor) ? minor : 0,
        patch: Number.isFinite(patch) ? patch : 0,
    };
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

export const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export const generatePlayerId = (): string =>
    `annoto_player_id_${Math.random().toString(36).slice(2, 8)}`;

export const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
