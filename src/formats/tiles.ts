import { IAnnotoMoodleMain, IMoodleAnnoto } from 'interfaces';
import { debounce, delay } from '../util';

const { moodleAnnoto } = window as unknown as { moodleAnnoto: IMoodleAnnoto };
const { $ } = moodleAnnoto;

export class AnnotoMoodleTiles {
    private static main: IAnnotoMoodleMain;
    private static tileOpen = false;
    private static modalOpen = false;
    private static observer?: MutationObserver;
    private static contentObserver?: MutationObserver;
    private static failsafeTimer?: ReturnType<typeof setInterval>;

    private static isTileOpen = (): boolean =>
        !!$('body.format-tiles').hasClass('format-tiles-tile-open');
    private static isModalOpen = (): boolean =>
        !!(
            $('body.format-tiles').hasClass('modal-open') ||
            $('body.format-tiles').find('.modal.show').length
        );

    private static mutationHandle = (mutationList?: MutationRecord[]): void => {
        const isTileOpen = this.isTileOpen();
        const isModalOpen = this.isModalOpen();
        if (
            isTileOpen !== this.tileOpen ||
            isModalOpen !== this.modalOpen ||
            !mutationList?.length
        ) {
            this.handleStateChange();
        }
    };

    private static getTilesContainer = (): HTMLElement | null =>
        $('body.format-tiles #multi_section_tiles').get(0) || null;

    /**
     * The widget player is missing or no longer inside the tiles container
     * (format_tiles replaced the tile content), so detection must run again.
     */
    private static needsPlayerDetection = (container: HTMLElement): boolean => {
        const activeEl = this.main.widgetPlayer?.playerElement;
        return !activeEl || !container.contains(activeEl);
    };

    /**
     * format_tiles (JS navigation) loads and replaces the open tile content over AJAX after the
     * tile is marked open, so a player can appear or be replaced without any class change.
     */
    private static contentHandle = (): void => {
        if (!this.tileOpen || this.modalOpen) {
            return;
        }
        const container = this.getTilesContainer();
        if (!container || !this.needsPlayerDetection(container)) {
            return;
        }
        const { main } = this;
        const hadPlayer = !!main.widgetPlayer;
        const player = main.findPlayer(container);
        if (player?.playerElement?.offsetParent) {
            main.log.info('AnnotoMoodle: tile content changed, load widget');
            main.moveApp(container);
            main.bootWidget(container);
        } else if (hadPlayer) {
            main.log.info('AnnotoMoodle: tile content changed, player removed');
            main.destroyWidget();
        }
    };

    private static updateContentObserver(): void {
        const container = this.tileOpen && !this.modalOpen ? this.getTilesContainer() : null;
        if (!container) {
            this.contentObserver?.disconnect();
            return;
        }
        if (!this.contentObserver) {
            this.contentObserver = new MutationObserver(debounce(this.contentHandle, 300));
        }
        // observe() on the same target replaces the previous options, so this is idempotent
        this.contentObserver.observe(container, { childList: true, subtree: true });
    }

    private static async handleStateChange(): Promise<void> {
        const { main } = this;
        const isModalOpen = this.isModalOpen();
        const isModalChanged = this.modalOpen !== isModalOpen;
        this.tileOpen = this.isTileOpen();
        this.modalOpen = isModalOpen;
        this.updateContentObserver();
        main.log.info('AnnotoMoodle: tile open state changed: ', this.tileOpen, this.modalOpen);
        if (isModalChanged) {
            // wait for modal to be fully opened so player find give correct results
            await delay(isModalOpen ? 500 : 200);
        }
        let container: HTMLElement | null = null;
        if (this.modalOpen) {
            container = $('.modal.show').get(0);
        } else if (this.tileOpen) {
            container = this.getTilesContainer();
        }
        if (container) {
            main.moveApp(container);
        } else {
            main.moveAppBackHome();
        }
        const player = main.findPlayer(container);
        if (player?.playerElement?.offsetParent) {
            main.bootWidget(container);
        } else {
            main.destroyWidget();
        }
    }

    static init(main: IAnnotoMoodleMain): void {
        this.main = main;
        this.tileOpen = this.isTileOpen();
        this.modalOpen = this.isModalOpen();

        const observerNodeTargets = document.querySelectorAll(
            main.formatSelectors.tiles.join(', ')
        );

        if (observerNodeTargets.length > 0) {
            this.observer = new MutationObserver(debounce(this.mutationHandle, 300));

            observerNodeTargets.forEach((target) => {
                this.observer?.observe(target, {
                    attributes: true,
                    childList: false,
                    subtree: false,
                    attributeFilter: ['class'],
                });
            });

            if (this.tileOpen || this.modalOpen || main.widgetPlayer?.playerElement?.offsetParent) {
                // A tile (or modal) that is already open at init produces no class change, so neither
                // the observer nor the failsafe below would ever run player detection for it. This
                // happens when format_tiles restores the last opened tile from localStorage
                // (mdl-tiles-course-<id>-user-<id>-lastSecId) before this script loads, and is why
                // the widget only appeared in a fresh (incognito) browser.
                // Also makes sure the widget is properly loaded or destroyed for a detached player element.
                this.mutationHandle();
            }

            this.updateContentObserver();

            // failsafe in case of not fired mutation event
            this.failsafeTimer = setInterval(() => {
                if (this.isTileOpen() !== this.tileOpen || this.isModalOpen() !== this.modalOpen) {
                    this.handleStateChange();
                } else if (main.widgetPlayer && !main.widgetPlayer.playerElement?.isConnected) {
                    // tile content was replaced while the widget was still booting
                    this.contentHandle();
                }
            }, 1000);
        }
    }

    static destroy(): void {
        this.observer?.disconnect();
        this.observer = undefined;
        this.contentObserver?.disconnect();
        this.contentObserver = undefined;
        if (this.failsafeTimer !== undefined) {
            clearInterval(this.failsafeTimer);
            this.failsafeTimer = undefined;
        }
    }
}
