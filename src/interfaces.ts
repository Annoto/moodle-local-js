import { IConfig, PlayerType } from '@annoto/widget-api';

export interface IMoodleJsParams {
    loginUrl: string;
    bootstrapUrl: string;
    clientId: string;
    userToken: string;
    locale?: string;
    mediaTitle: string;
    mediaDescription?: string;
    mediaGroupId: string;
    mediaGroupTitle: string;
    mediaGroupDescription?: string;
    deploymentDomain: string;
    moodleVersion: string;
    moodleRelease: string;
    cmid?: string;
    activityCompletionEnabled?: boolean;
    activityCompletionReq?: IActivityCompletionRequirements;
    userScope?: 'user' | 'super-mod';
    userIsEnrolled?: boolean;
}

export interface IMoodleAnnoto {
    $: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    log: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    notification: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    Ajax?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    VimeoPlayer: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    videojs?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    kApp: {
        kdpMap: KalturaKdpMapType;
    }; // eslint-disable-line @typescript-eslint/no-explicit-any
    kV7App?: {
        playersMap: KalturaV7PlayersMapType;
    };
    /**
     * Set by plugin versions that handle Kaltura V7 (playkit) players. When absent (older plugin),
     * the bundle keeps the pre-V7 behaviour so it stays backward compatible.
     */
    kalturaV7?: boolean;
    params: IMoodleJsParams;
    require: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    tr?: IMoodleTr;
    setupKalturaKdpMap?: (kdpMap: KalturaKdpMapType) => void;
    setupKalturaV7PlayersMap?: (playersMap: KalturaV7PlayersMapType) => void;
}

export interface IAnnotoMoodleMain {
    readonly log: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    readonly isWidgetLoaded: boolean;
    readonly formatSelectors: Record<MoodlePageFormatType, string[]>;
    readonly widgetPlayer: IPlayerParams | undefined;
    /**
     * Bootstrap or load the widget using annoto api
     * @param container
     */
    bootWidget(container?: HTMLElement | null): Promise<void>;
    destroyWidget(player?: IPlayerParams): Promise<void>;
    findPlayer(container?: HTMLElement | null): IPlayerParams | undefined;
    moveApp(container: HTMLElement): void;
    moveAppBackHome(): void;
}

export type KalturaKdpMapType = Record<string, IKalturaKdp>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface IKalturaKdp {
    id: string;
    player: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    config: IConfig;
    doneCb?: () => void;
    setupDone?: boolean;
}

export type KalturaV7PlayersMapType = Record<string, IKalturaV7Player>;
export interface IKalturaV7Player {
    id: string;
    player: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    /**
     * The Annoto playkit plugin service (player.getService('annoto')).
     */
    service: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    /**
     * Widget config provided by the playkit plugin onSetup hook.
     */
    config?: IConfig;
    /**
     * Releases the deferred widget boot (resolves the onSetup promise with config).
     */
    doneCb?: () => void;
    setupDone?: boolean;
}

export interface IMoodle {
    tabtopics?: unknown;
    format_grid?: unknown;
    format_topcoll?: unknown;
    snapTheme?: unknown;
}

export interface IMoodleRelease {
    /**
     * @default 0
     */
    major: number;
    /**
     * @default 0
     */
    minor: number;
    /**
     * @default 0
     */
    patch: number;
}

export type MoodlePageFormatType =
    | 'plain'
    | 'tabs'
    | 'grid'
    | 'topcoll'
    | 'snap'
    | 'modtab'
    | 'tiles'
    | 'icontent'
    | 'modtabDivs'
    | 'kalvidres'
    | 'lti';

export interface IMoodleTr {
    get_string: (key: string, component: string) => Promise<string>;
}

export interface IMoodleCompletionPostResponse {
    status: boolean;
    message: string;
}

export interface IActivityCompletionRequirements {
    id: string;
    courseid: string;
    cmid: string;
    enabled: ActivityCompletionTrackingType;
    totalview: string;
    comments: string;
    replies: string;
    completionexpected?: string;
    usermodified: string;
    timecreated: string;
    timemodified: string;
    user_data?: IActivityCompletionUserData;
}

export interface IActivityCompletionUserData {
    id: string;
    completionid: string;
    // json string of IMyActivity
    data: string;
    userid: string;
    usermodified: string;
    timecreated: string;
    timemodified: string;
}

export enum ActivityCompletionTrackingType {
    NONE = '0',
    MANUAL = '1',
    AUTOMATIC = '2',
    ANNOTO = '9',
}

export interface IPlayerParams {
    playerType: PlayerType;
    playerId: string;
    playerElement: HTMLElement;
}
