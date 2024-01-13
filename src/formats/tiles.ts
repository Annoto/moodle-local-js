import { AnnotoMoodle } from '../main';

const DEFULT_SEARCH_INTERVAL = 200;
const DEFULT_SEARCH_COUNT = 20;

export class AnnotoMoodleTiles {
    private static parent: AnnotoMoodle;
    private static isloaded = false;

    static init = (parent: AnnotoMoodle): void => {
        this.parent = parent;

        let activeTileObserver: MutationObserver;
        const handleUpdateOfActiveTile = () => {
            let searchCount = 0;
            const findActiveTileInterval = setInterval(() => {
                const activeTile = $(
                    'body.format-tiles #multi_section_tiles li.section.main.moveablesection.state-visible'
                )[0];
                if (!activeTile) {
                    searchCount += 1;
                    if (searchCount > DEFULT_SEARCH_COUNT) {
                        clearInterval(findActiveTileInterval);
                        this.parent.log.info('AnnotoMoodle: modal player not found');
                    }
                    return;
                }
                clearInterval(findActiveTileInterval);
                if (this.parent.annotoAPI && this.isloaded) {
                    this.parent.annotoAPI.destroy().then(() => {
                        this.isloaded = false;
                    });
                }
                if (activeTileObserver) {
                    activeTileObserver.disconnect();
                }
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
                this.parent.log.info('AnnotoMoodle: reload on active tile change');
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
    };

    private static updateActiveTile(activeTile: HTMLElement): void {
        this.addSubscriptionForOpenPageElements(activeTile);
        const player = this.parent.findPlayer(activeTile);

        if (player) {
            if (this.parent.bootsrapDone) {
                this.parent.prepareConfig();
                this.parent.annotoAPI?.load(this.parent.config).then(() => {
                    this.isloaded = true;
                });
            } else {
                this.parent.bootsrapDone = this.isloaded = true; // FIXME: set isLoaded only after boot
                this.parent.moodleAnnoto.require(
                    [this.parent.params.bootstrapUrl],
                    this.parent.bootWidget.bind(this.parent)
                );
            }
        }
    }

    private static addSubscriptionForOpenPageElements(activeTile: HTMLElement): void {
        const pageOpenModElements = $(activeTile).find(
            'li.activity.activity-wrapper.modtype_page a'
        );
        pageOpenModElements.each((_index: unknown, target: HTMLElement) => {
            const pageOpenClickHandler = () => {
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
                        this.parent.log.info('AnnotoMoodle: modal not found');
                    }
                }, DEFULT_SEARCH_INTERVAL);
            };
            $(target).on('click', pageOpenClickHandler);
        });
    }

    private static handleOpenModalWindow = (modalWindow: HTMLElement) => {
        let searchCount = 0;
        const findPlayerInterval = setInterval(() => {
            const player = this.parent.findPlayer(modalWindow);

            if (player) {
                clearInterval(findPlayerInterval);
                const observer = new MutationObserver((mutationList: MutationRecord[]) => {
                    const targetModal = mutationList[0].target as HTMLElement;
                    if (
                        targetModal.classList.contains('hide') &&
                        this.parent.annotoAPI &&
                        this.isloaded
                    ) {
                        this.parent.annotoAPI.destroy().then(() => {
                            this.isloaded = false;
                        });
                        observer.disconnect();
                    }
                });
                observer.observe(modalWindow as HTMLElement, {
                    attributes: true,
                    childList: false,
                    subtree: false,
                });
                if (this.parent.bootsrapDone) {
                    this.parent.prepareConfig();
                    this.parent.annotoAPI?.load(this.parent.config).then(() => {
                        this.isloaded = true;
                    });
                } else {
                    this.parent.bootsrapDone = this.isloaded = true; // FIXME: set isLoaded only after boot
                    this.parent.moodleAnnoto.require(
                        [this.parent.params.bootstrapUrl],
                        this.parent.bootWidget.bind(this.parent)
                    );
                }
            } else {
                searchCount += 1;
                if (searchCount > DEFULT_SEARCH_COUNT) {
                    clearInterval(findPlayerInterval);
                    this.parent.log.info('AnnotoMoodle: modal player not found');
                }
            }
        }, DEFULT_SEARCH_INTERVAL);
    };
}

