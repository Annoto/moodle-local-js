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
}

export interface IMoodleAnnoto {
    $: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    log: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    notification: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    VimeoPlayer: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    videojs?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    /**
     * @deprecated
     */
    videoJsPlayer: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    kApp: {
        kdpMap: KalturaKdpMapType;
    }; // eslint-disable-line @typescript-eslint/no-explicit-any
    params: IMoodleJsParams;
    require: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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

export type MoodlePageFormatType = 'plain' | 'tabs' | 'grid' | 'topcoll' | 'snap' | 'modtab' | 'tiles' | 'icontent' | 'modtabDivs';