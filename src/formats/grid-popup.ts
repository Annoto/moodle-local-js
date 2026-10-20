import { IAnnotoMoodleMain } from 'interfaces';
import { debounce, delay } from '../util';

/**
 * format_grid 4.x shows a section in a Bootstrap popup: a carousel of sections in a fixed modal
 * whose body scrolls. Older format_grid (#gridshadebox) has no such popup.
 */
export const GRID_POPUP_SELECTOR = 'body.format-grid #gridPopup';
const POPUP_SCROLLER_SELECTOR = '.modal-body';
const POPUP_SLIDE_SELECTOR = '.carousel-item';
const POPUP_ACTIVE_SLIDE_SELECTOR = '.carousel-item.active';
const POPUP_OPEN_CLASS = 'show';
const ANNOTO_APP_SELECTOR = '#annoto-app';
// popup open and slide changes fire a burst of class changes
const MUTATION_DEBOUNCE_MS = 300;
// the popup fades and slides in; detect the player once it is in place
const POPUP_SETTLE_MS = 500;
// leaving fullscreen and resizing move the layout after the event fires
const LAYOUT_SETTLE_MS = 300;
const FULLSCREEN_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'];

/**
 * The app wrapper styles while mounted in the popup: a box over the whole popup at its origin,
 * clipped, that scrolls (by script) with the popup body. The widget places itself from layout
 * offsets, which ignore scroll positions, so scrolling the box moves the widget with the player
 * however often it re-measures. Changing `top` instead would shift those offsets, and a transform
 * would make the box the containing block of the widget's position: fixed tooltips and dialogs.
 */
const MOUNT_STYLE = {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
} as const;
type TMountStyleKey = keyof typeof MOUNT_STYLE;

export class AnnotoMoodleGridPopup {
    private static main?: IAnnotoMoodleMain;
    private static popup: HTMLElement | null = null;
    private static scroller: HTMLElement | null = null;
    private static spacer: HTMLElement | null = null;
    private static isOpen = false;
    private static observer?: MutationObserver;

    private static isPopupOpen = (): boolean => !!this.popup?.classList.contains(POPUP_OPEN_CLASS);

    private static handleStateChange = async (): Promise<void> => {
        const { main, popup } = this;
        if (!main || !popup) {
            return;
        }
        const isOpen = this.isPopupOpen();
        if (isOpen !== this.isOpen) {
            this.isOpen = isOpen;
            main.log.info(`AnnotoMoodle: grid popup ${isOpen ? 'opened' : 'closed'}`);
            if (isOpen) {
                this.mount();
                await delay(POPUP_SETTLE_MS);
            } else {
                this.unmount();
            }
            if (this.isOpen !== isOpen) {
                return;
            }
        }
        if (isOpen) {
            this.loadPopupPlayer();
        } else {
            this.loadPagePlayer();
        }
    };

    private static syncScroll = (): void => {
        const { main, scroller, spacer } = this;
        if (!main || !scroller || !spacer) {
            return;
        }
        const { appEl } = main;
        // let the app scroll as far as the popup body
        spacer.style.height = `${
            scroller.scrollHeight - scroller.clientHeight + appEl.clientHeight
        }px`;
        appEl.scrollTop = scroller.scrollTop;
    };

    private static syncScrollLater = debounce(this.syncScroll, LAYOUT_SETTLE_MS);

    private static syncScrollNowAndLater = (): void => {
        this.syncScroll();
        this.syncScrollLater();
    };

    static init(main: IAnnotoMoodleMain): void {
        const popup = document.querySelector<HTMLElement>(GRID_POPUP_SELECTOR);
        if (!popup) {
            return;
        }
        this.main = main;
        this.popup = popup;
        this.observer = new MutationObserver(
            debounce(this.handleStateChange, MUTATION_DEBOUNCE_MS)
        );
        // the popup and its slides only: once mounted, the widget changes classes inside the popup
        [popup, ...Array.from(popup.querySelectorAll(POPUP_SLIDE_SELECTOR))].forEach((el) => {
            this.observer?.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        if (this.isPopupOpen()) {
            this.handleStateChange();
        }
    }

    static destroy(): void {
        this.observer?.disconnect();
        this.observer = undefined;
        if (this.isOpen) {
            this.unmount();
        }
        this.isOpen = false;
        this.popup = null;
        this.main = undefined;
    }

    /**
     * Attach the widget to the player of the shown section. A widget left on a page player would
     * be drawn over the popup, so it goes when the shown section has no player.
     */
    private static loadPopupPlayer(): void {
        const { main, popup } = this;
        if (!main || !popup) {
            return;
        }
        const slide = popup.querySelector<HTMLElement>(POPUP_ACTIVE_SLIDE_SELECTOR) || popup;
        const player = main.findPlayer(slide);
        if (player?.playerElement?.offsetParent) {
            main.bootWidget(slide);
            return;
        }
        const widgetEl = main.widgetPlayer?.playerElement;
        if (widgetEl && !popup.contains(widgetEl)) {
            main.destroyWidget();
        }
    }

    private static loadPagePlayer(): void {
        const { main } = this;
        if (!main) {
            return;
        }
        const player = main.findPlayer();
        if (
            player?.playerElement?.offsetParent &&
            player.playerId !== main.widgetPlayer?.playerId
        ) {
            main.bootWidget();
        }
    }

    private static mount(): void {
        const { main, popup } = this;
        if (!main || !popup) {
            return;
        }
        const { appEl } = main;
        main.playerScope = popup;
        main.moveApp(popup);
        Object.assign(appEl.style, MOUNT_STYLE);
        const app = appEl.querySelector<HTMLElement>(ANNOTO_APP_SELECTOR);
        if (app) {
            app.style.pointerEvents = 'auto';
        }
        const spacer = document.createElement('div');
        Object.assign(spacer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '1px',
            visibility: 'hidden',
            pointerEvents: 'none',
        });
        appEl.appendChild(spacer);
        this.spacer = spacer;
        this.scroller = popup.querySelector<HTMLElement>(POPUP_SCROLLER_SELECTOR);
        this.scroller?.addEventListener('scroll', this.syncScroll, { passive: true });
        window.addEventListener('resize', this.syncScrollNowAndLater);
        FULLSCREEN_EVENTS.forEach((ev) =>
            document.addEventListener(ev, this.syncScrollNowAndLater)
        );
        this.syncScroll();
    }

    private static unmount(): void {
        const { main } = this;
        this.scroller?.removeEventListener('scroll', this.syncScroll);
        window.removeEventListener('resize', this.syncScrollNowAndLater);
        FULLSCREEN_EVENTS.forEach((ev) =>
            document.removeEventListener(ev, this.syncScrollNowAndLater)
        );
        this.spacer?.remove();
        this.spacer = null;
        this.scroller = null;
        if (!main) {
            return;
        }
        const { appEl } = main;
        appEl.scrollTop = 0;
        (Object.keys(MOUNT_STYLE) as TMountStyleKey[]).forEach((key) => {
            appEl.style[key] = '';
        });
        if (!appEl.getAttribute('style')) {
            appEl.removeAttribute('style');
        }
        const app = appEl.querySelector<HTMLElement>(ANNOTO_APP_SELECTOR);
        if (app) {
            app.style.pointerEvents = '';
        }
        main.playerScope = undefined;
        main.moveAppBackHome();
    }
}
