import {
    Annoto as AnnotoMain,
    IAnnotoApi,
    IConfig,
    IGroupDetails,
    IHooks,
    IMediaDetails,
    IPlayerConfig,
    IWidgetBackendOptions,
    PlayerType,
} from '@annoto/widget-api';
import { BUILD_ENV } from './constants';
import {
    IKalturaKdp,
    IMoodle,
    IMoodleAnnoto,
    IMoodleJsParams,
    IMoodleRelease,
    KalturaKdpMapType,
    MoodlePageFormatType,
} from './interfaces';
import { debounce, parseMoodleVersion } from './util';

export { IMoodleJsParams } from './interfaces';

export const VERSION = BUILD_ENV.version;
export const NAME = BUILD_ENV.name;
declare const Annoto: AnnotoMain;
declare const M: IMoodle;

const global = window as unknown as {
    moodleAnnoto: IMoodleAnnoto;
    Annoto: AnnotoMain;
};
const { moodleAnnoto } = window as unknown as { moodleAnnoto: IMoodleAnnoto };
const { $ } = moodleAnnoto;
let { log } = moodleAnnoto;

try {
    if (window.sessionStorage.getItem('moodleAnnotoDebug')) {
        log = console;
    }
} catch (err) {
    /* empty */
}

class AnnotoMoodle {
    params!: IMoodleJsParams;
    isSetup = false;
    bootsrapDone = false;
    isloaded = false;
    annotoAPI?: IAnnotoApi;
    config!: IConfig;
    playerType?: PlayerType;
    playerId?: string;
    playerElement?: HTMLElement;
    videojsResolvePromise?: Promise<unknown>;
    moodleFormat: MoodlePageFormatType = 'plain';

    setup(params: IMoodleJsParams): void {
        if (this.isSetup) {
            log.warn('AnnotoMoodle: already setup');
            return;
        }
        log.info('AnnotoMoodle: setup');
        this.isSetup = true;
        this.params = params;

        this.detectFormat();
        this.tilesInit();
        this.icontentInit();
        this.kalturaInit();
        this.wistiaIframeEmbedInit();
        $(document).ready(this.bootstrap.bind(this));
    }

    get hooks(): IHooks {
        return {
            getPageUrl: () => window.location.href,
            ssoAuthRequestHandle: () => {
                window.location.replace(this.params.loginUrl);
            },
            mediaDetails: this.enrichMediaDetails.bind(this),
        };
    }

    get group(): IGroupDetails {
        const { params } = this;

        return {
            id: params.mediaGroupId,
            title: params.mediaGroupTitle,
            description: params.mediaGroupDescription,
        };
    }

    get backend(): IWidgetBackendOptions {
        return {
            domain: this.params.deploymentDomain,
        };
    }

    get configOverride(): Partial<IConfig> {
        const { params } = this;

        const config: Partial<IConfig> = {
            clientId: params.clientId,
            backend: this.backend,
            hooks: this.hooks,
            group: this.group,
        };
        if (params.locale) {
            config.locale = params.locale;
        }
        return config;
    }

    get moodleRelease(): IMoodleRelease {
        return parseMoodleVersion(this.params?.moodleRelease);
    }

    get pageEl(): HTMLElement | null {
        return document.getElementById('page');
    }

    get formatSelectors(): Record<MoodlePageFormatType, string> {
        const doNotMatchSelector = 'body.do-not-match-any-selector';
        return {
            plain: doNotMatchSelector,
            grid: 'body.format-grid .grid_section, body.format-grid #gridshadebox',
            topcoll: 'body.format-topcoll .ctopics.topics .toggledsection ',
            tabs: 'body.format-tabtopics .yui3-tab-panel',
            snap: 'body.format-topics.theme-snap .topics .section.main',
            modtab: '#page-mod-tab-view .TabbedPanelsContentGroup .TabbedPanelsContent',
            modtabDivs: '#page-mod-tab-view #TabbedPanelsTabContent > div',
            tiles: 'body.format-tiles #multi_section_tiles li.section.main.moveablesection',
            icontent: doNotMatchSelector,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get videojs(): Promise<any> {
        if (moodleAnnoto.videojs) {
            return Promise.resolve(moodleAnnoto.videojs);
        }
        if (!this.videojsResolvePromise) {
            this.videojsResolvePromise = new Promise((resolve) => {
                moodleAnnoto.require(['media_videojs/video-lazy'], resolve);
            });
        }
        return this.videojsResolvePromise;
    }

    detectFormat(): void {
        if (typeof M.tabtopics !== 'undefined') {
            this.moodleFormat = 'tabs';
        } else if (typeof M.format_grid !== 'undefined') {
            this.moodleFormat = 'grid';
        } else if (typeof M.format_topcoll !== 'undefined') {
            this.moodleFormat = 'topcoll';
        } else if (typeof M.snapTheme !== 'undefined') {
            this.moodleFormat = 'snap';
        } else if (document.body.id === 'page-mod-tab-view') {
            if (document.querySelector('#page-mod-tab-view #TabbedPanelsTabContent > div')) {
                this.moodleFormat = 'modtabDivs';
            } else {
                this.moodleFormat = 'modtab';
            }
        } else if (document.body.classList.contains('format-tiles')) {
            this.moodleFormat = 'tiles';
        } else if (document.body.classList.contains('path-mod-icontent')) {
            this.moodleFormat = 'icontent';
        } else {
            this.moodleFormat = 'plain';
        }
        log.info(`AnnotoMoodle: detected activity format: ${this.moodleFormat}`);
    }

    kalturaInit(): void {
        const maKApp = moodleAnnoto.kApp;
        moodleAnnoto.setupKalturaKdpMap = this.setupKalturaKdpMap.bind(this);

        if (maKApp) {
            log.info('AnnotoMoodle: Kaltura loaded on init');
            this.setupKalturaKdpMap(maKApp.kdpMap);
        } else {
            log.info('AnnotoMoodle: Kaltura not loaded on init');
        }
    }

    hasAnnotoTag(): boolean {
        return $('annoto').length > 0 && $('annotodisable').length === 0;
    }

    findPlayer(container?: HTMLElement | null): HTMLElement | undefined {
        log.info('AnnotoMoodle: detecting player');
        const parent = container || document.body;
        const h5p = $(parent).find('iframe.h5p-iframe').first().get(0);
        const youtube = $(parent).find('iframe[src*="youtube.com"]').first().get(0);
        const vimeo = $(parent).find('iframe[src*="vimeo.com"]').first().get(0);
        const videojs = $(parent).find('.video-js').first().get(0);
        const jwplayer = $(parent).find('.jwplayer').first().get(0);
        const wistia = $(parent).find('.wistia_embed').first().get(0);
        const html5 = $(parent).find('video').first().get(0);
        let playerElement: HTMLElement;

        if (videojs) {
            playerElement = videojs;
            this.playerType = 'videojs';
        } else if (jwplayer) {
            playerElement = jwplayer;
            this.playerType = 'jw';
        } else if (h5p) {
            playerElement = h5p;
            this.playerType = 'h5p';
        } else if (youtube) {
            const youtubeSrc = youtube.src;
            if (youtubeSrc.search(/enablejsapi/i) === -1) {
                youtube.src =
                    youtubeSrc.search(/[?]/) === -1
                        ? `${youtubeSrc}?enablejsapi=1`
                        : `${youtubeSrc}&enablejsapi=1`;
            }
            playerElement = youtube;
            this.playerType = 'youtube';
        } else if (vimeo) {
            playerElement = vimeo;
            this.playerType = 'vimeo';
        } else if (wistia) {
            playerElement = wistia;
            this.playerType = 'wistia';
        } else if (html5) {
            playerElement = html5;
            this.playerType = 'html5';
        } else {
            log.info('AnnotoMoodle: player not detected');
            return undefined;
        }

        if (!playerElement.id || playerElement.id === '') {
            playerElement.id = `annoto_player_id_${Math.random().toString(36).substr(2, 6)}`;
        }
        this.playerId = playerElement.id;
        this.playerElement = playerElement;

        log.info(`AnnotoMoodle: detected ${this.playerType}: ${this.playerId}`);

        return playerElement;
    }

    bootstrap(): void {
        log.info('AnnotoMoodle: bootstrap');
        if (this.bootsrapDone) {
            return;
        }
        // TODO: first search can find wrong player element (ex. modtabDivs)
        // because wrong one appears first in DOM, after some time it replaced by correct one
        const playerEl = this.findPlayer();

        if (playerEl) {
            const innerPageWrapper = document.getElementById('page-wrapper');
            if (innerPageWrapper) {
                const annotoWrapper = document.createElement('div');
                annotoWrapper.id = 'annoto-app';
                innerPageWrapper.appendChild(annotoWrapper);
                log.info('AnnotoMoodle: appended annoto-app container');
            }

            this.bootsrapDone = true;
            moodleAnnoto.require([this.params.bootstrapUrl], this.bootWidget.bind(this));
        }
    }

    prepareConfig(): void {
        const { config, playerId, playerType } = this;
        const nonOverlayTimelinePlayers = ['youtube', 'vimeo'];

        config.widgets[0].player.type = playerType as PlayerType;
        config.widgets[0].player.element = `#${playerId}`;
        config.widgets[0].timeline = {
            overlay: nonOverlayTimelinePlayers.indexOf(playerType as string) === -1,
        };
    }

    bootWidget(): void {
        log.info('AnnotoMoodle: boot widget');
        this.config = {
            ...this.configOverride,
            widgets: [{ player: {} as IPlayerConfig }],
        };

        this.prepareConfig();

        if (global.Annoto) {
            Annoto.on('ready', this.annotoReady.bind(this));
            if (this.playerType === 'videojs') {
                this.videojs.then((vjs) => {
                    this.config.widgets[0].player.params = {
                        videojs: vjs,
                    };
                    Annoto.boot(this.config);
                });
            } else {
                Annoto.boot(this.config);
            }
        } else {
            log.warn('AnnotoMoodle: bootstrap didn`t load');
        }
        const { major, minor } = this.moodleRelease;
        if (major === 4 && minor < 3) {
            const { pageEl } = this;
            if (pageEl) {
                log.info('AnnotoMoodle: apply page scroll fix');
                pageEl.style.overflow = 'visible';
                // moodle has a js that sets overflow to auto on resize for smaller screens
                $(window).on(
                    'resize',
                    debounce(() => {
                        pageEl.style.overflow = 'visible';
                    }, 500)
                );
            }
        }
    }

    annotoReady(api: IAnnotoApi): void {
        // Api is the API to be used after Annoot is setup
        // It can be used for SSO auth.
        this.annotoAPI = api;
        const jwt = this.params.userToken;
        log.info('AnnotoMoodle: widget ready');
        if (jwt && jwt !== '') {
            api.auth(jwt).catch(() => {
                log.error('AnnotoMoodle: SSO auth error');
            });
        } else {
            log.info('AnnotoMoodle: SSO auth skipped');
        }

        // TODO: shouldn't this be at setup?
        this.checkWidgetVisibility();
        // TODO: fix setup flow for multiple players
        this.findMultiplePlayers();
    }

    kalturaPluginReadyHandle(api: IAnnotoApi): void {
        // Api is the API to be used after Annoot is setup
        // It can be used for SSO auth.
        const jwt = this.params.userToken;
        log.info('AnnotoMoodle: annoto ready (Kaltura)');
        if (jwt && jwt !== '') {
            api.auth(jwt).catch(() => {
                log.error('AnnotoMoodle: SSO auth error (Kaltura)');
            });
        } else {
            log.info('AnnotoMoodle: SSO auth skipped (Kaltura)');
        }
    }

    setupKalturaKdpMap(kdpMap: KalturaKdpMapType): void {
        if (!kdpMap) {
            log.info('AnnotoMoodle: skip setup Kaltura players - missing map');
            return;
        }
        log.info('AnnotoMoodle: setup Kaltura players');
        Object.values(kdpMap).forEach((kdp) => {
            this.setupKalturaKdp(kdp);
        });
    }

    setupKalturaKdp(kdp: IKalturaKdp): void {
        if (!kdp.config || kdp.setupDone || !kdp.doneCb) {
            log.info(`AnnotoMoodle: skip Kaltura player: ${kdp.id}`);
            return;
        }
        log.info(`AnnotoMoodle: setup Kaltura player: ${kdp.id}`);
        kdp.setupDone = true; // eslint-disable-line no-param-reassign
        kdp.player.kBind('annotoPluginReady', this.kalturaPluginReadyHandle.bind(this));
        this.setupKalturaPlugin(kdp.config);
        kdp.doneCb();
    }

    setupKalturaPlugin(config: IConfig): void {
        /*
         * Config will contain the annoto widget configuration.
         * This hook provides a chance to modify the configuration if required.
         * Below we use this chance to attach the ssoAuthRequestHandle and mediaDetails hooks.
         * https://github.com/Annoto/widget-api/blob/master/lib/config.d.ts#L128
         *
         * NOTICE: config is already setup by the Kaltura Annoto plugin,
         * so we need only to override the required configuration, such as
         * clientId, group, etc. DO NOT CHANGE THE PLAYER TYPE OR PLAYER ELEMENT CONFIG.
         */
        Object.assign(config, this.configOverride);
    }

    enrichMediaDetails(mediaParams: {
        widgetIndex: number;
        mediaSrc: string;
        details?: IMediaDetails;
    }): IMediaDetails {
        // The details contains MediaDetails the plugin has managed to obtain
        // This hook gives a change to enrich the details with additional information.
        // https://github.com/Annoto/widget-api/blob/master/lib/media-details.d.ts#L6.
        const retVal = (mediaParams && mediaParams.details) || ({} as IMediaDetails);

        retVal.title = retVal.title || this.params.mediaTitle;
        retVal.description = retVal.description || this.params.mediaDescription;
        retVal.outcomes = {
            ...retVal.outcomes,
            ...{ isExpected: true },
        };

        return retVal;
    }

    checkWidgetVisibility(): void {
        const { moodleFormat, formatSelectors } = this;
        const supportedFormats: MoodlePageFormatType[] = [
            'tabs',
            'grid',
            'topcoll',
            'snap',
            'modtab',
            'modtabDivs',
        ];

        if (!supportedFormats.includes(moodleFormat)) {
            return;
        }

        // TODO: debounce ?
        const reloadAnnoto = (mutationList?: MutationRecord[]): void => {
            let mutationTarget: HTMLElement | null = null;
            if (mutationList) {
                switch (moodleFormat) {
                    case 'tabs':
                        mutationTarget = mutationList.filter((m) =>
                            (m.target as HTMLElement).classList.contains('yui3-tab-panel-selected')
                        )[0]?.target as HTMLElement;
                        break;
                    case 'grid':
                        mutationTarget = mutationList.filter(
                            (m) => !(m.target as HTMLElement).classList.contains('hide_section')
                        )[0]?.target as HTMLElement;
                        break;
                    case 'topcoll':
                        mutationTarget = mutationList[0].target as HTMLElement;
                        break;
                    case 'snap':
                        mutationTarget = mutationList.filter((m) =>
                            (m.target as HTMLElement).classList.contains('state-visible')
                        )[0]?.target as HTMLElement;
                        break;
                    case 'modtab':
                        mutationTarget = mutationList.filter((m) =>
                            (m.target as HTMLElement).classList.contains(
                                'TabbedPanelsContentVisible'
                            )
                        )[0]?.target as HTMLElement;
                        break;
                    case 'modtabDivs':
                        mutationTarget = mutationList.filter((m) => {
                            if (m.type !== 'attributes') {
                                return false;
                            }
                            const { classList } = m.target as HTMLElement;
                            return classList.contains('active') && classList.contains('show');
                        })[0]?.target as HTMLElement;
                        break;
                    default:
                        break;
                }
            } else {
                switch (moodleFormat) {
                    case 'modtabDivs':
                        mutationTarget = document.body.querySelector(
                            `${this.formatSelectors.modtabDivs}.active`
                        );
                        break;
                    default:
                        break;
                }
            }

            if (mutationList && !mutationTarget) {
                return;
            }

            log.info(`AnnotoMoodle: reload on ${moodleFormat} change`);

            const playerElement = this.findPlayer(mutationTarget);
            if (playerElement) {
                this.prepareConfig();
            }
            if (playerElement?.offsetParent) {
                this.annotoAPI?.load(this.config);
            } else {
                this.annotoAPI?.destroy();
            }
        };

        const observerNodeTargets = document.querySelectorAll(
            Object.values(formatSelectors).join(', ')
        );

        if (observerNodeTargets.length > 0) {
            const observer = new MutationObserver(reloadAnnoto);

            observerNodeTargets.forEach((target) => {
                // TODO: map of attirbutes for each course format?
                observer.observe(target, { attributes: true, childList: true, subtree: false });
            });

            if (!this.playerElement?.offsetParent) {
                // will make sure widget is properly loaded or destroyed for detached player element
                reloadAnnoto();
            }
        }
    }

    wistiaIframeEmbedInit(): void {
        const iframeElements = document.querySelectorAll('iframe');
        const annotoIframeClient = 'https://cdn.annoto.net/widget-iframe-api/latest/client.js';
        const targetHost = 'fast.wistia.net';
        const desiredParam = {
            name: 'plugin[annoto][src]',
            value: 'cdn.annoto.net',
        };

        iframeElements.forEach((iframeEl) => {
            let iframeSrc;
            try {
                iframeSrc = new URL(iframeEl.src);
            } catch (err) {
                return;
            }
            const targetParam = iframeSrc.searchParams.get(desiredParam.name);
            if (iframeSrc.host !== targetHost) {
                return;
            }

            if (targetParam && targetParam.match(desiredParam.value)) {
                // FIXME: why is this in a the loop, reuiqre the iframe client only once
                moodleAnnoto.require(
                    [annotoIframeClient],
                    this.setupWistiaIframeEmbedPlugin.bind(this, iframeEl)
                );
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setupWistiaIframeEmbedPlugin(iframeEl: HTMLElement, AnnotoIframeApi: any): void {
        const { params } = this;
        const annoto = new AnnotoIframeApi.Client(iframeEl);

        annoto.onSetup((next: (config: Partial<IConfig>) => void) => {
            next(this.configOverride);
        });

        annoto.onReady((api: IAnnotoApi) => {
            const token = params.userToken;
            api.auth(token).catch((err) => {
                if (err) {
                    log.error('AnnotoMoodle: Wistia Embed SSO auth error', err);
                }
            });
        });
    }

    tilesInit(): void {
        if (this.moodleFormat !== 'tiles') {
            return;
        }

        const reloadAnnoto = (mutationList: MutationRecord[]): void => {
            let mutationTarget: MutationRecord[] = [];

            if (mutationList) {
                mutationTarget = mutationList.filter(
                    (m) =>
                        m.attributeName === 'class' &&
                        (m.target as Element).classList.contains('state-visible')
                );
            }

            if (!mutationTarget.length) {
                if (this.annotoAPI && this.isloaded) {
                    this.annotoAPI.destroy().then(() => {
                        this.isloaded = false;
                    });
                }
                return;
            }
            log.info('AnnotoMoodle: reload on tiles change');
            setTimeout(() => {
                const player = this.findPlayer(mutationTarget[0].target as HTMLElement);

                if (player) {
                    if (this.bootsrapDone) {
                        this.prepareConfig();
                        this.annotoAPI?.load(this.config).then(() => {
                            this.isloaded = true;
                        });
                    } else {
                        this.bootsrapDone = this.isloaded = true; // FIXME: set isLoaded only after boot
                        moodleAnnoto.require(
                            [this.params.bootstrapUrl],
                            this.bootWidget.bind(this)
                        );
                    }
                }
            }, 2000);
        };

        const observerNodeTargets = document.querySelectorAll(this.formatSelectors.tiles);

        if (observerNodeTargets.length > 0) {
            const observer = new MutationObserver(reloadAnnoto);

            observerNodeTargets.forEach((target) => {
                observer.observe(target, { attributes: true, childList: false, subtree: false });
            });
        }
    }

    icontentInit(): void {
        if (this.moodleFormat !== 'icontent') {
            return;
        }
        const wrapper = document.getElementById('region-main');
        const idIcontentPages = document.getElementById('idicontentpages');

        const reloadAnnoto = (): void => {
            if (this.annotoAPI && this.isloaded) {
                this.annotoAPI.destroy().then(() => {
                    this.isloaded = false;
                });
            }

            log.info('AnnotoMoodle: reload on icontent change');
            setTimeout(() => {
                const player = this.findPlayer(idIcontentPages);

                if (player) {
                    if (this.bootsrapDone) {
                        this.prepareConfig();
                        this.annotoAPI?.load(this.config).then(() => {
                            this.isloaded = true;
                        });
                    } else {
                        this.bootsrapDone = this.isloaded = true; // FIXME set isLoaded only after boot
                        moodleAnnoto.require(
                            [this.params.bootstrapUrl],
                            this.bootWidget.bind(this)
                        );
                    }
                }
            }, 2000);
        };

        wrapper?.addEventListener('click', (event) => {
            if (!(event.target as HTMLElement)?.matches('.load-page')) {
                return;
            }
            reloadAnnoto();
        });
    }

    async findMultiplePlayers(): Promise<void> {
        if (this.moodleFormat !== 'plain') {
            return;
        }
        const vimeos = $('body').find('iframe[src*="vimeo.com"]').get();
        const videojs = $('body').find('.video-js').get();
        const allPlayers: {
            vimeo?: HTMLElement[];
            videojs?: HTMLElement[];
        } = {
            ...(vimeos.length > 1 && { vimeo: [...vimeos] }),
            ...(videojs.length > 1 && { videojs: [...videojs] }),
        };
        const vjs = await this.videojs;

        log.info('AnnotoMoodle: setup multiple players');

        const validatePlayerId = (element: Element): void => {
            if (!element.id || element.id === '') {
                // eslint-disable-next-line no-param-reassign
                element.id = `annoto_player_id_${Math.random().toString(36).substr(2, 6)}`;
            }
        };

        const reloadAnnotoWidget = (element: HTMLElement, playerType: PlayerType): void => {
            this.playerId = element.id;
            this.playerElement = element;
            this.playerType = playerType;
            this.prepareConfig();

            log.info(`AnnotoMoodle: reload widget for ${playerType}: ${element.id}`);
            this.annotoAPI?.load(this.config);
        };

        for (const [playerType, players] of Object.entries(allPlayers)) {
            players.forEach((player) => {
                validatePlayerId(player);

                log.info(`AnnotoMoodle: setup Player: ${playerType} ${player.id}`);
                switch (playerType) {
                    case 'vimeo': {
                        const vimeoPlayer = new moodleAnnoto.VimeoPlayer(player);
                        vimeoPlayer.on('play', () => {
                            if (player.id === this.playerId) {
                                return;
                            }
                            log.info(`AnnotoMoodle: Player play: ${playerType} ${player.id}`);

                            reloadAnnotoWidget(player, playerType);
                        });
                        break;
                    }
                    case 'videojs': {
                        const playerJs = vjs(player.id);
                        playerJs.player().on('play', () => {
                            if (player.id === this.playerId) {
                                return;
                            }
                            log.info(`AnnotoMoodle: Player play: ${playerType} ${player.id}`);

                            reloadAnnotoWidget(player, playerType);
                        });
                        break;
                    }
                    default:
                        break;
                }
            });
        }
    }
}

export const annotoMoodleLocal = new AnnotoMoodle();
export const setup = (): void => {
    annotoMoodleLocal.setup(moodleAnnoto.params);
};
