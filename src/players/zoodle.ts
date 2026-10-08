/**
 * Zoodle (MACAM's Zoom recordings service for Moodle, zoodle.macam.ac.il) embeds a recording as a
 * cross-origin iframe: `https://zoodle.macam.ac.il/<institution>/media/<mediaId>`.
 * The page inside the iframe is a bare HTML5 <video> whose source is
 * `https://zoodle.macam.ac.il/<institution>/files/<mediaId>.mp4` (poster under `files/frames/`),
 * with no player API and no postMessage bridge, so the widget cannot attach to it.
 *
 * Since the recording is a plain progressive MP4 that plays cross-origin without CORS, we swap the
 * iframe for an equivalent native <video> on the Moodle page, which the regular html5 player
 * detection then picks up.
 */

const ZOODLE_HOST_RE = /(^|\.)zoodle\.macam\.ac\.il$/i;
// tolerate the double slash Zoodle emits (`//qsm/media/<id>`) and an optional trailing slash
const ZOODLE_MEDIA_PATH_RE = /^\/+([\w-]+)\/media\/([\w-]+)\/?$/;
const ZOODLE_MARKER_ATTR = 'data-annoto-zoodle';
// coarse pre-filter for the caller's lookup; parseZoodleSrc does the real host/path check
export const ZOODLE_IFRAME_SELECTOR = 'iframe[src*="zoodle."]';

export interface IZoodleMedia {
    origin: string;
    institution: string;
    mediaId: string;
    videoSrc: string;
    posterSrc: string;
}

export const parseZoodleSrc = (src?: string | null): IZoodleMedia | undefined => {
    if (!src) {
        return undefined;
    }
    let url: URL;
    try {
        url = new URL(src, window.location.href);
    } catch (err) {
        return undefined;
    }
    if (url.protocol !== 'https:' || !ZOODLE_HOST_RE.test(url.hostname)) {
        return undefined;
    }
    const match = url.pathname.match(ZOODLE_MEDIA_PATH_RE);
    if (!match) {
        return undefined;
    }
    const [, institution, mediaId] = match;
    const base = `${url.origin}/${institution}/files`;
    return {
        origin: url.origin,
        institution,
        mediaId,
        videoSrc: `${base}/${mediaId}.mp4`,
        posterSrc: `${base}/frames/${mediaId}.jpg`,
    };
};

export const createZoodleVideo = (
    iframeEl: HTMLIFrameElement,
    media: IZoodleMedia
): HTMLVideoElement => {
    const video = document.createElement('video');
    video.controls = true;
    video.preload = 'metadata';
    video.setAttribute('playsinline', '');
    // same restriction the Zoodle page applies
    video.setAttribute('controlslist', 'nodownload');
    video.setAttribute(ZOODLE_MARKER_ATTR, media.mediaId);
    video.poster = media.posterSrc;

    const source = document.createElement('source');
    source.src = media.videoSrc;
    source.type = 'video/mp4';
    video.appendChild(source);

    // keep the author's sizing so the page layout does not jump
    ['id', 'class', 'width', 'height', 'title'].forEach((attr) => {
        const value = iframeEl.getAttribute(attr);
        if (value) {
            video.setAttribute(attr, value);
        }
    });
    video.style.cssText = iframeEl.style.cssText;
    video.style.maxWidth = video.style.maxWidth || '100%';
    video.style.backgroundColor = '#000';
    return video;
};

/**
 * Replace the given Zoodle iframes with native <video> elements. Iframes that are not Zoodle embeds
 * are left alone, so the caller can pass a loose selector match.
 *
 * Takes the elements rather than a root node on purpose: `findPlayer` resolves its scope with
 * jQuery (`$(parent).find(...)`) because `parent` is not always an element - jQuery's document
 * ready callback hands it the jQuery function itself - and the native `querySelectorAll` on it
 * threw and killed player detection for every page (1.4.0).
 *
 * Idempotent: a replaced iframe is gone from the DOM, so repeated calls are no-ops.
 * @returns number of iframes replaced
 */
export const replaceZoodleIframes = (
    iframes: ArrayLike<HTMLIFrameElement>,
    log?: { info: (msg: string) => void; warn: (msg: string) => void }
): number => {
    let replaced = 0;
    for (let i = 0; i < iframes.length; i += 1) {
        const iframeEl = iframes[i];
        const media = parseZoodleSrc(iframeEl.getAttribute('src'));
        if (!media) {
            continue; // eslint-disable-line no-continue
        }
        try {
            const video = createZoodleVideo(iframeEl, media);
            iframeEl.replaceWith(video);
            replaced += 1;
            log?.info(`AnnotoMoodle: replaced Zoodle iframe with html5 video: ${media.mediaId}`);
        } catch (err) {
            log?.warn(`AnnotoMoodle: failed to replace Zoodle iframe ${media.mediaId}: ${err}`);
        }
    }
    return replaced;
};
