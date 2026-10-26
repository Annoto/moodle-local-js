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

/**
 * Whether the element has a box on the page. False under a `display: none` ancestor (a closed
 * Grid popup, a collapsed section, an inactive tab), where the widget would be drawn at 0,0.
 */
export const isRendered = (el?: Element | null): boolean =>
    !!el && el.isConnected && el.getClientRects().length > 0;

const SCROLLING_OVERFLOW = /^(auto|scroll|overlay)$/;

/**
 * The outermost ancestor of `el`, below `<body>`, that scrolls its own content vertically - the
 * page scroller of themes that scroll inside a layout element (Boost Union scrolls #page-wrapper)
 * instead of the window. The outermost one, so a small `.no-overflow` box around the player is not
 * mistaken for it. Null when the window scrolls the page, or when `el` is inside a fixed element
 * (a modal), which does not move with the page scroller.
 */
export const findPageScroller = (el: Element): HTMLElement | null => {
    const { body, documentElement, defaultView } = el.ownerDocument;
    let scroller: HTMLElement | null = null;
    for (
        let node = el.parentElement;
        node && node !== body && node !== documentElement;
        node = node.parentElement
    ) {
        const style = defaultView?.getComputedStyle(node);
        if (style?.position === 'fixed') {
            return null;
        }
        if (
            style &&
            SCROLLING_OVERFLOW.test(style.overflowY) &&
            node.scrollHeight > node.clientHeight
        ) {
            scroller = node;
        }
    }
    return scroller;
};

export interface IPlayerCandidates<TType> {
    type: TType;
    elements: HTMLElement[];
}

/**
 * Pick the player to attach the widget to from candidates in priority order: the first rendered
 * one, so a player in a closed popup or collapsed section does not win over one on screen; else
 * the first one, so the widget still boots and can follow it once it is shown.
 */
export const pickPlayer = <TType>(
    candidates: IPlayerCandidates<TType>[]
): { type: TType; element: HTMLElement } | undefined => {
    const all = candidates.flatMap(({ type, elements }) =>
        elements.map((element) => ({ type, element }))
    );
    return all.find(({ element }) => isRendered(element)) || all[0];
};
