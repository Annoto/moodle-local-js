import { IConfig } from '@annoto/widget-api';

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
    params: IMoodleJsParams;
    require: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    tr?: IMoodleTr;
    setupKalturaKdpMap?: (kdpMap: KalturaKdpMapType) => void;
}

export type KalturaKdpMapType = Record<string, IKalturaKdp>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface IKalturaKdp {
    id: string;
    player: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    config: IConfig;
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
    | 'snapMultiple'
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
