import {
    Annoto as AnnotoMain,
    IAnnotoApi,
    IConfig,
    IFrameMessage,
    IFrameResponse,
    IGroupDetails,
    IHooks,
    IMediaDetails,
    IMyActivity,
    IPlayerConfig,
    IWidgetBackendOptions,
    PlayerType,
} from '@annoto/widget-api';
import { BUILD_ENV } from './constants';
import {
    IAnnotoMoodleMain,
    IKalturaKdp,
    IMoodle,
    IMoodleAnnoto,
    IMoodleCompletionPostResponse,
    IMoodleJsParams,
    IMoodleRelease,
    IMoodleTr,
    IPlayerParams,
    KalturaKdpMapType,
    MoodlePageFormatType,
} from './interfaces';
import { debounce, parseMoodleVersion } from './util';
import { AnnotoMoodleTiles } from './formats/tiles';

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

class AnnotoMoodle implements IAnnotoMoodleMain {
    params!: IMoodleJsParams;
    isSetup = false;
    bootsrapDone = false;
    isloaded = false;
    annotoAPI?: IAnnotoApi;
    config!: IConfig;
    activePlayer?: IPlayerParams;
    videojsResolvePromise?: Promise<unknown>;
    moodleFormat: MoodlePageFormatType = 'plain';
    readonly log: typeof log = log;
    myActivityResponse?: IMyActivity;
    trPromise?: Promise<IMoodleTr>;
    appEl: HTMLElement;
    appContainer: HTMLElement;

    constructor() {
        this.appEl = document.createElement('div');
        this.appEl.id = 'moodle-annoto-app-wrapper';
        const annotoAppEl = document.createElement('div');
        annotoAppEl.id = 'annoto-app';
        this.appEl.appendChild(annotoAppEl);
        this.appContainer = document.getElementById('page-wrapper') || document.body;
        this.appContainer.appendChild(this.appEl);
        const stopPropagation = (ev: UIEvent): void => {
            ev.stopPropagation();
        };
        // contain annoto app click events
        // fixes modal close on clicks inside the widget
        $('#annoto-app').on('click', stopPropagation);
        this.appEl.addEventListener('click', stopPropagation);
    }

    setup(params: IMoodleJsParams): void {
        if (this.isSetup) {
            log.warn('AnnotoMoodle: already setup');
            return;
        }
        log.info('AnnotoMoodle: setup');
        this.isSetup = true;
        this.params = params;

        this.detectFormat();
        const { moodleFormat } = this;
        switch (moodleFormat) {
            case 'tiles':
                AnnotoMoodleTiles.init(this);
                break;
            case 'icontent':
                this.icontentInit();
                break;
            case 'kalvidres':
                this.kalturaModInit();
                break;
            case 'lti':
                this.annotoLtiInit();
                break;
            default:
                break;
        }

        this.kalturaInit();
        this.wistiaIframeEmbedInit();
        $(document).ready(this.bootstrap.bind(this));
        this.updateCompletionStatus();
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
            ssoToken: params.userToken || undefined,
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

    get formatSelectors(): Record<MoodlePageFormatType, string[]> {
        const doNotMatchSelector = 'body.do-not-match-any-selector';
        return {
            plain: ['body.format-topics .section.main'],
            grid: ['body.format-grid .grid_section, body.format-grid #gridshadebox'],
            topcoll: ['body.format-topcoll .ctopics.topics .toggledsection'],
            tabs: ['body.format-tabtopics .yui3-tab-panel'],
            snap: [
                'body.format-topics.theme-snap .section.main .activity',
                'body.format-topics.theme-snap .section.main',
            ],
            modtab: ['#page-mod-tab-view .TabbedPanelsContentGroup .TabbedPanelsContent'],
            modtabDivs: ['#page-mod-tab-view #TabbedPanelsTabContent > div'],
            tiles: ['body.format-tiles', 'body.format-tiles #multi_section_tiles li.section.main'],
            icontent: [doNotMatchSelector],
            kalvidres: [doNotMatchSelector],
            lti: [doNotMatchSelector],
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

    get tr(): Promise<IMoodleTr> {
        if (moodleAnnoto.tr) {
            return Promise.resolve(moodleAnnoto.tr);
        }
        if (!this.trPromise) {
            this.trPromise = new Promise((resolve) => {
                moodleAnnoto.require(['core/str'], resolve);
            });
        }
        return this.trPromise;
    }

    get myActivity(): IMyActivity | undefined {
        const {
            myActivityResponse,
            params: { activityCompletionReq },
        } = this;
        return (
            myActivityResponse ??
            (activityCompletionReq?.user_data?.data
                ? JSON.parse(activityCompletionReq.user_data.data)
                : undefined)
        );
    }

    get completionInfoEl(): HTMLElement | null {
        return document.querySelector('.activity-information > [data-region="completion-info"]');
    }

    get isActivityCompleted(): boolean {
        const { params, myActivity, canCompleteActivity } = this;
        const { activityCompletionEnabled: enabled, activityCompletionReq: req } = params;
        if (!canCompleteActivity) {
            return false;
        }

        if (!enabled || !req) {
            return true;
        }

        if (enabled && !myActivity) {
            return false;
        }
        const totalView = +req.totalview;
        const comments = +req.comments;
        const replies = +req.replies;
        const emptyReq = totalView <= 0 && comments <= 0 && replies <= 0;
        const viewCompleted = totalView === 0 || (myActivity && totalView <= myActivity.completion);
        const commentsCompleted = comments === 0 || (myActivity && comments <= myActivity.comments);
        const repliesCompleted = replies === 0 || (myActivity && replies <= myActivity.replies);

        return !!(emptyReq || (viewCompleted && commentsCompleted && repliesCompleted));
    }

    get isModerator(): boolean {
        const { userScope } = this.params;
        return userScope === 'super-mod';
    }

    get canCompleteActivity(): boolean {
        const {
            isModerator,
            params: { userIsEnrolled, userToken },
        } = this;
        return !!(!isModerator && userIsEnrolled && userToken);
    }

    get isWidgetLoaded(): boolean {
        return this.isloaded;
    }

    get widgetPlayer(): IPlayerParams | undefined {
        return this.activePlayer;
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
        } else if (document.body.id === 'page-mod-kalvidres-view') {
            this.moodleFormat = 'kalvidres';
        } else if (document.body.classList.contains('format-tiles')) {
            this.moodleFormat = 'tiles';
        } else if (document.body.classList.contains('path-mod-icontent')) {
            this.moodleFormat = 'icontent';
        } else if (document.body.id === 'page-mod-lti-view') {
            this.moodleFormat = 'lti';
        } else {
            this.moodleFormat = 'plain';
        }
        log.info(`AnnotoMoodle: detected activity format: ${this.moodleFormat}`);
    }

    annotoLtiInit(): void {
        const { moodleFormat, params, canCompleteActivity } = this;
        const { activityCompletionEnabled } = params;
        if (moodleFormat !== 'lti') {
            return;
        }
        const iframEl = document.querySelector('#contentframe') as HTMLIFrameElement;
        log.info('AnnotoMoodle: LTI mod detected: ', !!iframEl);

        if (!iframEl) {
            log.warn('AnnotoMoodle: LTI mod iframe not found');
            return;
        }

        if (!activityCompletionEnabled || !canCompleteActivity) {
            // nothing to do here
            return;
        }
        const subscriptionId = `annoto_lti_mod_${iframEl.id}`;
        let subscriptionDone = false;
        window.addEventListener(
            'message',
            (ev) => {
                try {
                    const data = JSON.parse(ev.data) as IFrameResponse;
                    if (data.aud !== 'annoto_widget' || data.id !== subscriptionId) {
                        return;
                    }
                    if (data.err) {
                        log.error(`AnnotoMoodle: LTI mod iframe API error: ${data.err}`);
                        return;
                    }

                    if (data.type === 'subscribe') {
                        log.info(`AnnotoMoodle: LTI mod subscribed to my_activity`);
                        subscriptionDone = true;
                        return;
                    }
                    if (data.type === 'event') {
                        const { data: eventData } = data as IFrameResponse<'event'>;
                        if (eventData?.eventName === 'my_activity') {
                            this.myActivityHandle(eventData.eventData as IMyActivity);
                        }
                    }
                } catch (e) {
                    /* empty */
                }
            },
            false
        );

        const subscribeToMyActivity = (): void => {
            if (subscriptionDone) {
                return;
            }
            const msg: IFrameMessage<'subscribe'> = {
                aud: 'annoto_widget',
                id: subscriptionId,
                action: 'subscribe',
                data: 'my_activity',
            };
            try {
                iframEl.contentWindow?.postMessage(JSON.stringify(msg), '*');
                log.info('AnnotoMoodle: Kaltura mod request subscribeToMyActivity');
            } catch (e) {
                /* empty */
            }
            setTimeout(subscribeToMyActivity, 2000);
        };

        subscribeToMyActivity();
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

    kalturaModInit(): void {
        const { moodleFormat, params, canCompleteActivity } = this;
        if (moodleFormat !== 'kalvidres') {
            return;
        }

        const iframEl = document.querySelector('#contentframe') as HTMLIFrameElement;
        log.info('AnnotoMoodle: Kaltura mod detected: ', !!iframEl);

        if (!iframEl) {
            log.warn('AnnotoMoodle: Kaltura mod iframe not found');
            return;
        }
        const { activityCompletionEnabled } = params;

        if (!activityCompletionEnabled || !canCompleteActivity) {
            // nothing to do here
            return;
        }
        const subscriptionId = `annoto_kaltura_mod_${iframEl.id}`;
        let subscriptionDone = false;
        window.addEventListener(
            'message',
            (ev) => {
                try {
                    const data = JSON.parse(ev.data) as IFrameResponse;
                    if (data.aud !== 'annoto_widget' || data.id !== subscriptionId) {
                        return;
                    }
                    if (data.err) {
                        log.error(`AnnotoMoodle: Kaltura mod iframe API error: ${data.err}`);
                        return;
                    }

                    if (data.type === 'subscribe') {
                        log.info(`AnnotoMoodle: Kaltura mod subscribed to my_activity`);
                        subscriptionDone = true;
                        return;
                    }
                    if (data.type === 'event') {
                        const { data: eventData } = data as IFrameResponse<'event'>;
                        if (eventData?.eventName === 'my_activity') {
                            this.myActivityHandle(eventData.eventData as IMyActivity);
                        }
                    }
                } catch (e) {
                    /* empty */
                }
            },
            false
        );

        const subscribeToMyActivity = (): void => {
            if (subscriptionDone) {
                return;
            }
            const msg: IFrameMessage<'subscribe'> = {
                aud: 'annoto_widget',
                id: subscriptionId,
                action: 'subscribe',
                data: 'my_activity',
            };
            try {
                // we have no way to know if it's v2 with nested iframe of v7, so send to both
                const v2PlayerFrame = iframEl.contentWindow?.frames[0];
                if (v2PlayerFrame) {
                    v2PlayerFrame.postMessage(JSON.stringify(msg), '*');
                }
                iframEl.contentWindow?.postMessage(JSON.stringify(msg), '*');
                log.info('AnnotoMoodle: Kaltura mod request subscribeToMyActivity');
            } catch (e) {
                /* empty */
            }
            setTimeout(subscribeToMyActivity, 2000);
        };

        subscribeToMyActivity();
    }

    hasAnnotoTag(): boolean {
        return $('annoto').length > 0 && $('annotodisable').length === 0;
    }

    findPlayer(container?: HTMLElement | null): IPlayerParams | undefined {
        log.info('AnnotoMoodle: detecting player');
        const parent = container || document.body;
        const h5p = $(parent).find('iframe.h5p-iframe').first().get(0);
        const youtube = $(parent).find('iframe[src*="youtube.com"]').first().get(0);
        const vimeo = $(parent).find('iframe[src*="vimeo.com"]').first().get(0);
        const videojs = $(parent).find('.video-js').first().get(0);
        const jwplayer = $(parent).find('.jwplayer').first().get(0);
        const wistia = $(parent).find('.wistia_embed:not(iframe)').first().get(0);
        const html5 = $(parent).find('video').first().get(0);
        let playerElement: HTMLElement;
        let playerType: PlayerType;

        if (videojs) {
            playerElement = videojs;
            playerType = 'videojs';
        } else if (jwplayer) {
            playerElement = jwplayer;
            playerType = 'jw';
        } else if (h5p) {
            playerElement = h5p;
            playerType = 'h5p';
        } else if (youtube) {
            const youtubeSrc = youtube.src;
            if (youtubeSrc.search(/enablejsapi/i) === -1) {
                youtube.src =
                    youtubeSrc.search(/[?]/) === -1
                        ? `${youtubeSrc}?enablejsapi=1`
                        : `${youtubeSrc}&enablejsapi=1`;
            }
            playerElement = youtube;
            playerType = 'youtube';
        } else if (vimeo) {
            playerElement = vimeo;
            playerType = 'vimeo';
        } else if (wistia) {
            playerElement = wistia;
            playerType = 'wistia';
        } else if (html5) {
            playerElement = html5;
            playerType = 'html5';
        } else {
            log.info('AnnotoMoodle: player not detected');
            return undefined;
        }

        if (!playerElement.id || playerElement.id === '') {
            playerElement.id = `annoto_player_id_${Math.random().toString(36).substr(2, 6)}`;
        }
        const playerId = playerElement.id;

        log.info(`AnnotoMoodle: detected ${playerType}: ${playerId}`);

        return {
            playerId,
            playerType,
            playerElement,
        };
    }

    async prepareConfig(player: IPlayerParams): Promise<void> {
        const { config } = this;
        this.activePlayer = player;
        const { playerId, playerType, playerElement } = player;
        const nonOverlayTimelinePlayers = ['youtube', 'vimeo'];
        if (this.moodleFormat === 'snap') {
            // if widget side panel css applied directly to the player element, styling breaks for snap format
            config.widgets[0].positionElement = playerElement.parentElement as HTMLElement;
        }
        config.widgets[0].player.type = playerType as PlayerType;
        config.widgets[0].player.element = `#${playerId}`;
        config.widgets[0].timeline = {
            overlay: nonOverlayTimelinePlayers.indexOf(playerType as string) === -1,
        };
        if (playerType === 'videojs') {
            const vjs = await this.videojs;
            this.config.widgets[0].player.params = {
                videojs: vjs,
            };
        }
    }

    /**
     * If bootstap is not done, find player, and if found bootWidget
     * @returns
     */
    bootstrap(container?: HTMLElement | null): void {
        if (this.bootsrapDone) {
            return;
        }
        // FIXME: first search can find wrong player element (ex. modtabDivs) do not boot in this case, wait for mutation
        const player = this.findPlayer(container);

        if (player) {
            log.info('AnnotoMoodle: bootstrap');
            this.bootsrapDone = true;
            this.config = {
                ...this.configOverride,
                widgets: [{ player: {} as IPlayerConfig }],
            };
            moodleAnnoto.require([this.params.bootstrapUrl], () => this.bootstrapDone(container));
        } else {
            log.info('AnnotoMoodle: bootstrap skipped - player not found');
        }
    }

    /**
     * Call only from bootstrap
     * @returns
     */
    async bootstrapDone(container?: HTMLElement | null): Promise<void> {
        if (!global.Annoto) {
            log.warn('AnnotoMoodle: bootstrap didn`t load');
            return;
        }
        log.info('AnnotoMoodle: boot widget');
        Annoto.on('ready', this.annotoReady.bind(this));
        this.applyPageScrollFix();

        const player = this.findPlayer(container);
        if (!player) {
            return;
        }

        await this.prepareConfig(player);
        Annoto.boot(this.config);
    }

    annotoReady(api: IAnnotoApi): void {
        const { params, canCompleteActivity } = this;
        const { activityCompletionEnabled } = params;
        this.isloaded = true;
        this.annotoAPI = api;
        log.info('AnnotoMoodle: widget ready');
        if (activityCompletionEnabled && canCompleteActivity) {
            Annoto.on(`my_activity`, this.myActivityHandle);
        }

        // TODO: shouldn't this be at setup?
        this.checkWidgetVisibility();
        // TODO: fix setup flow for multiple players
        this.findMultiplePlayers();
    }

    moveApp(container: HTMLElement): void {
        const { appEl } = this;
        if (container !== appEl.parentElement) {
            container.appendChild(appEl);
            log.info(`AnnotoMoodle: moved annoto-app to ${container.id || container.className}`);
        }
    }

    moveAppBackHome(): void {
        const { appContainer, appEl } = this;
        if (appContainer !== appEl.parentElement) {
            appContainer.appendChild(appEl);
            log.info('AnnotoMoodle: moved annoto-app back to original container');
        }
    }

    async bootWidget(container?: HTMLElement | null): Promise<void> {
        if (!this.bootsrapDone) {
            return this.bootstrap(container);
        }
        return this.loadWidget(container);
    }

    /**
     * If bootstap is done, find player, prepare config and use annotoApi to load widget
     * @param container
     * @returns
     */
    async loadWidget(container?: HTMLElement | null): Promise<void> {
        if (!this.bootsrapDone || !this.annotoAPI) {
            return;
        }
        log.info('AnnotoMoodle: load widget');
        const player = this.findPlayer(container);
        if (!player || this.activePlayer?.playerId === player.playerId) {
            return;
        }
        await this.prepareConfig(player);
        await this.annotoAPI.load(this.config);
        this.isloaded = true;
    }

    /**
     * If annotoApi is available, destroy the widget
     * @param player if provided, will destroy widget only for matching player
     * @returns
     */
    async destroyWidget(player?: IPlayerParams): Promise<void> {
        if (!this.annotoAPI) {
            return;
        }
        if (player && this.activePlayer?.playerId !== player.playerId) {
            return;
        }
        log.info('AnnotoMoodle: destroy widget');
        this.activePlayer = undefined;
        await this.annotoAPI.destroy();
        this.isloaded = false;
    }

    kalturaPluginReadyHandle(): void {
        log.info('AnnotoMoodle: Kaltura ready');
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
            'plain',
        ];

        if (!supportedFormats.includes(moodleFormat)) {
            return;
        }

        const loadOrDestroyWidget = (mutationTarget?: HTMLElement): void => {
            const player = this.findPlayer(mutationTarget);
            if (player?.playerElement?.offsetParent) {
                log.info(`AnnotoMoodle: load on ${moodleFormat} change`);
                this.loadWidget(mutationTarget);
            } else {
                log.info(`AnnotoMoodle: destroy on ${moodleFormat} change`);
                this.destroyWidget();
            }
        };

        const mutationHandle = (mutationList?: MutationRecord[]): void => {
            let mutationTarget: HTMLElement | null = null;
            let debounceTime = 100;
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
                        const mutationRecord = mutationList[0]; // eslint-disable-line no-case-declarations
                        if (
                            mutationRecord?.type === 'attributes' &&
                            mutationRecord.attributeName === 'class'
                        ) {
                            mutationTarget = mutationRecord.target as HTMLElement;
                        }
                        debounceTime = 500;
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
                    case 'plain':
                        const plainMutationRecord = mutationList[0]; // eslint-disable-line no-case-declarations
                        if (
                            plainMutationRecord?.type === 'attributes' &&
                            plainMutationRecord.attributeName === 'data-locked'
                        ) {
                            mutationTarget = plainMutationRecord.target as HTMLElement;
                        }
                        debounceTime = 500;
                        break;
                    default:
                        break;
                }
            } else {
                switch (moodleFormat) {
                    case 'modtabDivs':
                        mutationTarget = document.body.querySelector(
                            `${this.formatSelectors.modtabDivs[0]}.active`
                        );
                        break;
                    default:
                        break;
                }
            }

            if (mutationList && !mutationTarget) {
                return;
            }

            debounce(loadOrDestroyWidget, debounceTime)(mutationTarget);
        };

        const observerNodeTargets = document.querySelectorAll(
            formatSelectors[moodleFormat].flat().join(', ')
        );

        if (observerNodeTargets.length > 0) {
            const observer = new MutationObserver(mutationHandle);

            observerNodeTargets.forEach((target) => {
                // TODO: map of attirbutes for each course format?
                observer.observe(target, { attributes: true, childList: true, subtree: false });
            });

            if (!this.activePlayer?.playerElement?.offsetParent) {
                // will make sure widget is properly loaded or destroyed for detached player element
                mutationHandle();
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
        const annoto = new AnnotoIframeApi.Client(iframeEl);

        annoto.onSetup((next: (config: Partial<IConfig>) => void) => {
            next(this.configOverride);
        });
    }

    icontentInit(): void {
        if (this.moodleFormat !== 'icontent') {
            return;
        }
        const wrapper = document.getElementById('region-main');
        const idIcontentPages = document.getElementById('idicontentpages');

        const reloadAnnoto = (): void => {
            if (this.isloaded) {
                this.destroyWidget();
            }

            log.info('AnnotoMoodle: reload on icontent change');
            setTimeout(() => this.bootWidget(idIcontentPages), 2000);
        };

        wrapper?.addEventListener('click', (event) => {
            if (!(event.target as HTMLElement)?.matches('.load-page')) {
                return;
            }
            reloadAnnoto();
        });
    }

    async findMultiplePlayers(): Promise<void> {
        const processedFormats: MoodlePageFormatType[] = ['plain', 'snap'];
        if (!processedFormats.includes(this.moodleFormat)) {
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

        const playHandle = async (
            playerElement: HTMLElement,
            playerType: PlayerType
        ): Promise<void> => {
            if (!this.annotoAPI) {
                return;
            }
            const playerId = playerElement.id;
            log.info(`AnnotoMoodle: player play handle: ${playerType} ${playerId}`);
            if (playerId === this.activePlayer?.playerId) {
                return;
            }
            await this.prepareConfig({
                playerType,
                playerElement,
                playerId,
            });

            log.info(`AnnotoMoodle: load widget for ${playerType}: ${playerId}`);
            await this.annotoAPI.load(this.config);
        };

        for (const [playerType, players] of Object.entries(allPlayers)) {
            players.forEach((player) => {
                validatePlayerId(player);

                log.info(`AnnotoMoodle: setup Player: ${playerType} ${player.id}`);
                switch (playerType) {
                    case 'vimeo': {
                        const vimeoPlayer = new moodleAnnoto.VimeoPlayer(player);
                        vimeoPlayer.on('play', () => playHandle(player, playerType));
                        break;
                    }
                    case 'videojs': {
                        const playerJs = vjs(player.id);
                        playerJs.player().on('play', () => playHandle(player, playerType));
                        break;
                    }
                    default:
                        break;
                }
            });
        }
    }

    async updateCompletionStatus(): Promise<void> {
        const { params, isActivityCompleted, myActivity, canCompleteActivity } = this;
        const { activityCompletionEnabled, activityCompletionReq } = params;

        log.info(
            `AnnotoMoodle: update completion status: ${JSON.stringify({
                activityCompletionEnabled,
                isActivityCompleted,
                completionInfoEl: !!this.completionInfoEl,
                activityCompletionReq: !!activityCompletionReq,
                myActivity: !!myActivity,
            })}`
        );

        if (!activityCompletionEnabled) {
            return;
        }

        this.addCompletionInfoSectionIfMissing();
        const { completionInfoEl } = this;
        if (!completionInfoEl) {
            return;
        }

        const requirementLabel = await this.getString(
            'overallaggregation',
            'completion',
            'Completion requirements'
        );
        const text = !canCompleteActivity
            ? requirementLabel
            : await this.getString(
                  isActivityCompleted ? 'done' : 'completeactivity',
                  'completion',
                  isActivityCompleted ? 'Done' : 'Complete activity'
              );

        let reqDetailsHtml: string[] = [];
        if (activityCompletionReq) {
            const reqDetails: { icon: string; value: string }[] = [];
            if (+activityCompletionReq.totalview > 0) {
                reqDetails.push({
                    icon: 'play',
                    value: !canCompleteActivity
                        ? `${activityCompletionReq.totalview}%`
                        : `${myActivity?.completion || 0}/${activityCompletionReq.totalview}%`,
                });
            }
            if (+activityCompletionReq.comments > 0) {
                reqDetails.push({
                    icon: 'comments',
                    value: !canCompleteActivity
                        ? `${activityCompletionReq.comments}`
                        : `${myActivity?.comments || 0}/${activityCompletionReq.comments}`,
                });
            }
            if (+activityCompletionReq.replies > 0) {
                reqDetails.push({
                    icon: 'reply',
                    value: !canCompleteActivity
                        ? `${activityCompletionReq.replies}`
                        : `${myActivity?.replies || 0}/${activityCompletionReq.replies}`,
                });
            }
            if (reqDetails.length > 0) {
                reqDetailsHtml = [
                    ...reqDetails.map(
                        (item) => `
                            <span style="padding:0 4px;">
                                <i class="icon fa fa-${item.icon} fa-fw" aria-hidden="true" style="font-size:16px;"></i> ${item.value}
                            </span>
                        `
                    ),
                ];
            }
        }
        moodleAnnoto.$(completionInfoEl).html(`
            <div class="automatic-completion-conditions" data-region="completionrequirements" role="list" aria-label="${requirementLabel}">
                <span class="badge badge-pill ${
                    isActivityCompleted ? 'alert-success' : 'badge-light'
                }" role="listitem">
                    <span><img src="https://cdn.annoto.net/assets/latest/images/icon.svg" aria-hidden="true" style="width:16px;height:auto;"> ${text}</span>
                    ${reqDetailsHtml.join('')}
                </span>
            </div>
        `);
    }

    addCompletionInfoSectionIfMissing(): void {
        if (this.completionInfoEl) {
            return;
        }
        moodleAnnoto.$('#maincontent').after(`
            <div data-region="activity-information" class="activity-information">
                <div class="completion-info" data-region="completion-info"></div>
            </div>
        `);
    }

    myActivityHandle = (data: IMyActivity): void => {
        const { params, canCompleteActivity } = this;
        const { activityCompletionEnabled, cmid } = params;
        log.info(`AnnotoMoodle: got my_activity event`);

        if (!activityCompletionEnabled || !cmid || !moodleAnnoto.Ajax || !canCompleteActivity) {
            log.warn('AnnotoMoodle: skip my_activity handling, activity completion not supported');
            return;
        }

        moodleAnnoto.Ajax.call([
            {
                methodname: 'local_annoto_set_completion',
                args: {
                    data: JSON.stringify({
                        ...data,
                        cmid: this.params.cmid,
                    }),
                },
                done: (result: IMoodleCompletionPostResponse): void => {
                    log.info(
                        `AnnotoMoodle: completion result (${result?.status}): ${result?.message}`
                    );
                    if (result?.status) {
                        this.myActivityResponse = data;
                        this.updateCompletionStatus();
                    }
                },
                fail: moodleAnnoto.notification.exception,
            },
        ]);
    };

    applyPageScrollFix(): void {
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

    /**
     * Safely Get translated string or user the default value
     * @param key
     * @param component
     * @param defaultResult
     * @returns
     */
    async getString(key: string, component: string, defaultResult = ''): Promise<string> {
        try {
            const tr = await this.tr;
            const result = await tr.get_string(key, component);
            if (!result) {
                log.warn(`AnnotoMoodle: getString: ${key} for component ${component} not found`);
            }
            return result || defaultResult;
        } catch (err) {
            log.error(`AnnotoMoodle: getString error: ${err}`);
        }
        return defaultResult;
    }
}

export const annotoMoodleLocal = new AnnotoMoodle();
export const setup = (): void => {
    annotoMoodleLocal.setup(moodleAnnoto.params);
};
