import { IAnnotoMoodleMain, IMoodleAnnoto } from 'interfaces';

const DEFULT_SEARCH_INTERVAL = 200;
const DEFULT_SEARCH_COUNT = 20;
const { moodleAnnoto } = window as unknown as { moodleAnnoto: IMoodleAnnoto };
const { $ } = moodleAnnoto;

export class AnnotoMoodleTiles {
    private static annotoMoodle: IAnnotoMoodleMain;

    static init(main: IAnnotoMoodleMain): void {
        this.annotoMoodle = main;

        let activeTileObserver: MutationObserver;
        let closedTileSearchInterval: ReturnType<typeof setInterval>;
        // Subscribe to click event on elements that considered as buttons that will open a tile section
        const handleUpdateOfActiveTile = (): void => {
            let searchCount = 0;
            const findActiveTileInterval = setInterval(() => {
                const activeTile = $(
                    'body.format-tiles #multi_section_tiles li.section.main.moveablesection.state-visible'
                )[0];
                if (!activeTile) {
                    searchCount += 1;
                    if (searchCount > DEFULT_SEARCH_COUNT) {
                        clearInterval(findActiveTileInterval);
                        this.annotoMoodle.log.info('AnnotoMoodle: visible tile section not found');
                    }
                    return;
                }
                clearInterval(findActiveTileInterval);
                // If annoto was already loaded, destroy it before loading it again
                if (this.annotoMoodle.isWidgetLoaded) {
                    this.annotoMoodle.destroyWidget();
                }
                // Disconnect previous observer if exists to avoid multiple observers
                if (activeTileObserver) {
                    activeTileObserver.disconnect();
                }
                if (closedTileSearchInterval) {
                    clearInterval(closedTileSearchInterval);
                }
                // Subscribe to close of visible tile section, which not open a new one to close the annoto widget if it was open
                closedTileSearchInterval = setInterval(() => {
                    const activeTile = $(
                        'body.format-tiles #multi_section_tiles li.section.main.moveablesection.state-visible'
                    )[0];
                    if (!activeTile) {
                        clearInterval(closedTileSearchInterval);
                        activeTileObserver.disconnect();
                        if (this.annotoMoodle.isWidgetLoaded) {
                            this.annotoMoodle.destroyWidget();
                        }
                    }
                }, DEFULT_SEARCH_INTERVAL);
                // on reload of active tile, happens in different time, for example resize
                // used to avoid lose of click subscription
                activeTileObserver = new MutationObserver(() => {
                    this.updateActiveTile(activeTile);
                });
                this.updateActiveTile(activeTile);
                activeTileObserver.observe(activeTile, {
                    attributes: false,
                    childList: true,
                    subtree: false,
                });
                this.annotoMoodle.log.info('AnnotoMoodle: reload on active tile change');
            }, DEFULT_SEARCH_INTERVAL);
        };

        const tileTargets = $('body.format-tiles #multi_section_tiles li.tile.tile-clickable');
        if (tileTargets.length > 0) {
            for (let i = 0; i < tileTargets.length; i++) {
                const target = tileTargets[i] as HTMLElement;
                target.addEventListener('click', () => {
                    handleUpdateOfActiveTile();
                });
            }
            handleUpdateOfActiveTile();
        }
    }

    // Find and load annoto widget for player in the modal window
    private static handleOpenModalWindow(modalWindow: HTMLElement): void {
        let searchCount = 0;
        const findPlayerInterval = setInterval(() => {
            const player = this.annotoMoodle.findPlayer(modalWindow);

            if (player) {
                clearInterval(findPlayerInterval);
                const annotoAppElement = $(`#annoto-app`);
                const observer = new MutationObserver((mutationList: MutationRecord[]) => {
                    const targetModal = mutationList[0].target as HTMLElement;
                    // close annoto widget if modal window was closed
                    if (
                        targetModal.classList.contains('hide') &&
                        this.annotoMoodle.isWidgetLoaded
                    ) {
                        const innerPageWrapper = document.getElementById('page-wrapper');
                        if (annotoAppElement && innerPageWrapper) {
                            // Append annoto widget to the page wrapper back for feature modal windows
                            annotoAppElement.appendTo(innerPageWrapper);
                        }
                        this.annotoMoodle.destroyWidget();
                        observer.disconnect();
                    }
                });
                observer.observe(modalWindow as HTMLElement, {
                    attributes: true,
                    childList: false,
                    subtree: false,
                });
                const modalContent = modalWindow.querySelector('.modal-content') as HTMLElement;
                // Avoid not needed scroll in modal window
                modalContent.style.overflow = 'unset';
                // Append annoto app element to the modal window because only in this case it will be visible
                if (annotoAppElement) {
                    annotoAppElement.appendTo(modalContent);
                }

                this.annotoMoodle.bootWidget(modalContent);
            } else {
                searchCount += 1;
                if (searchCount > DEFULT_SEARCH_COUNT) {
                    clearInterval(findPlayerInterval);
                    this.annotoMoodle.log.info('AnnotoMoodle: modal player not found');
                }
            }
        }, DEFULT_SEARCH_INTERVAL);
    }
    private static updateActiveTile(activeTile: HTMLElement): void {
        this.addSubscriptionForOpenPageElements(activeTile);
        // Load annoto widget for possible player in the active tile section
        setTimeout(() => this.annotoMoodle.bootWidget(activeTile), 2000);
    }

    // Subscribe to click event on elements that considered as buttons that will open a modal window
    private static addSubscriptionForOpenPageElements(activeTile: HTMLElement): void {
        const pageOpenModElements = $(activeTile).find(
            'li.activity.activity-wrapper.modtype_page a'
        );
        pageOpenModElements.each((_index: unknown, target: HTMLElement) => {
            const pageOpenClickHandler = (): void => {
                let searchCount = 0;
                const findModalInterval = setInterval(() => {
                    const modalWindow = $('.modal.mod_page.show')[0];
                    if (modalWindow) {
                        clearInterval(findModalInterval);
                        this.handleOpenModalWindow(modalWindow);
                    }
                    searchCount += 1;
                    if (searchCount > DEFULT_SEARCH_COUNT) {
                        clearInterval(findModalInterval);
                        this.annotoMoodle.log.info('AnnotoMoodle: modal not found');
                    }
                }, DEFULT_SEARCH_INTERVAL);
            };
            $(target).on('click', pageOpenClickHandler);
        });
    }
}
