import { IMyActivity } from '@annoto/widget-api';
import { IActivityCompletionRequirements, IMoodleRelease } from './interfaces';

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

/**
 * Course module id of the activity an element is rendered in on a course page. Moodle renders
 * every course module there as `li.activity#module-<cmid>`; a label exists only there.
 */
export const findCmId = (el?: Element | null): string | undefined =>
    el?.closest('li.activity[id^="module-"]')?.id.match(/^module-(\d+)$/)?.[1];

/** The completion area Moodle renders inside a course module on the course page. */
export const cmCompletionInfoEl = (cmid: string): HTMLElement | null =>
    document.querySelector(`li.activity#module-${cmid} [data-region="completion-info"]`);

export const isActivityCompletionMet = (
    req: IActivityCompletionRequirements,
    myActivity?: IMyActivity
): boolean => {
    // No reported activity is never complete, even with empty requirements (as on activity pages).
    if (!myActivity) {
        return false;
    }
    const totalView = +req.totalview;
    const comments = +req.comments;
    const replies = +req.replies;
    return (
        (totalView <= 0 || totalView <= myActivity.completion) &&
        (comments <= 0 || comments <= myActivity.comments) &&
        (replies <= 0 || replies <= myActivity.replies)
    );
};

/** The user's saved progress the plugin sends with the requirements (a json string of IMyActivity). */
export const parseUserActivity = (
    req: IActivityCompletionRequirements | undefined,
    logger: { error: (msg: string) => void }
): IMyActivity | undefined => {
    const data = req?.user_data?.data;
    if (!data) {
        return undefined;
    }
    try {
        return JSON.parse(data);
    } catch (err) {
        logger.error(`AnnotoMoodle: failed to parse my_activity user_data: ${err}`);
        return undefined;
    }
};
