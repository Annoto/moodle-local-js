import { IAnnotoMoodleMain, IMoodleAnnoto, IPlayerParams } from 'interfaces';
import { debounce, delay } from '../util';

const { moodleAnnoto } = window as unknown as { moodleAnnoto: IMoodleAnnoto };
const { $ } = moodleAnnoto;

export class AnnotoMoodleTiles {
    private static main: IAnnotoMoodleMain;
    private static tileOpen = false;
    private static modalOpen = false;
    private static player: IPlayerParams | undefined;

    private static isTileOpen = (): boolean =>
        !!$('body.format-tiles').hasClass('format-tiles-tile-open');
    private static isModalOpen = (): boolean =>
        !!(
            $('body.format-tiles').hasClass('modal-open') ||
            $('body.format-tiles').find('.modal.show').length
        );

    private static handleStateChange = async (): Promise<void> => {
        const { main } = this;
        const isModalOpen = this.isModalOpen();
        const isModalChanged = this.modalOpen !== isModalOpen;
        // If it is the same format and player on the page no need to reboot
        if (this.modalOpen && !isModalChanged && !this.player?.playerElement?.offsetParent) {
            return;
        }
        this.tileOpen = this.isTileOpen();
        this.modalOpen = isModalOpen;
        main.log.info('AnnotoMoodle: tile open state changed: ', this.tileOpen, this.modalOpen);
        if (isModalChanged) {
            // wait for modal to be fully opened so player find give correct results
            await delay(isModalOpen ? 500 : 200);
        }
        let container: HTMLElement | null = null;
        if (this.modalOpen) {
            container = $('.modal.show').get(0);
        } else if (this.tileOpen) {
            container = $('body.format-tiles #multi_section_tiles').get(0);
        }
        if (container) {
            main.moveApp(container);
        } else {
            main.moveAppBackHome();
        }
        const player = main.findPlayer(container);
        this.player = player;
        if (player?.playerElement?.offsetParent) {
            main.bootWidget(container);
            main.findMultiplePlayers(container)
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
            const observer = new MutationObserver(debounce(this.handleStateChange, 300));

            observerNodeTargets.forEach((target) => {
                observer.observe(target, {
                    attributes: true,
                    childList: false,
                    subtree: false,
                    attributeFilter: ['class'],
                });
            });

            if (main.widgetPlayer?.playerElement?.offsetParent) {
                // will make sure widget is properly loaded or destroyed for detached player element
                this.handleStateChange();
            }

            // failsafe in case of not fired mutation event
            setInterval(() => {
                if (this.isTileOpen() !== this.tileOpen || this.isModalOpen() !== this.modalOpen) {
                    this.handleStateChange();
                }
            }, 1000);
        }
    }
}
