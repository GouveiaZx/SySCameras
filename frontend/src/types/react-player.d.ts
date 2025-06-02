declare module 'react-player/lazy' {
  import ReactPlayer from 'react-player';
  export default ReactPlayer;
}

declare module 'react-player' {
  import * as React from 'react';

  export interface ReactPlayerProps {
    url?: string | string[] | null;
    playing?: boolean;
    loop?: boolean;
    controls?: boolean;
    volume?: number;
    muted?: boolean;
    playbackRate?: number;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    progressInterval?: number;
    playsinline?: boolean;
    pip?: boolean;
    stopOnUnmount?: boolean;
    light?: boolean | string;
    fallback?: React.ReactElement;
    wrapper?: React.ComponentType<any>;
    playIcon?: React.ReactElement;
    previewTabIndex?: number;
    config?: {
      file?: {
        forceVideo?: boolean;
        forceDASH?: boolean;
        forceHLS?: boolean;
        forceAudio?: boolean;
        attributes?: Record<string, any>;
        hlsOptions?: Record<string, any>;
        dashOptions?: Record<string, any>;
        flvOptions?: Record<string, any>;
        hlsVersion?: string;
        dashVersion?: string;
        flvVersion?: string;
      };
      youtube?: {
        playerVars?: Record<string, any>;
        embedOptions?: Record<string, any>;
        onUnstarted?: () => void;
        preload?: boolean;
      };
      facebook?: {
        appId?: string;
        version?: string;
        playerId?: string;
        attributes?: Record<string, any>;
      };
      dailymotion?: {
        params?: Record<string, any>;
      };
      vimeo?: {
        playerOptions?: Record<string, any>;
      };
      mixcloud?: {
        options?: Record<string, any>;
      };
      soundcloud?: {
        options?: Record<string, any>;
      };
      twitch?: {
        options?: Record<string, any>;
        playerId?: string;
      };
      wistia?: {
        options?: Record<string, any>;
        playerId?: string;
      };
    };
    onReady?: (player: ReactPlayer) => void;
    onStart?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onBuffer?: () => void;
    onBufferEnd?: () => void;
    onEnded?: () => void;
    onError?: (error: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => void;
    onDuration?: (duration: number) => void;
    onSeek?: (seconds: number) => void;
    onProgress?: (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => void;
    onClickPreview?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onEnablePIP?: () => void;
    onDisablePIP?: () => void;
    [key: string]: any;
  }

  export default class ReactPlayer extends React.Component<ReactPlayerProps> {
    static canPlay(url: string): boolean;
    static canEnablePIP(url: string): boolean;
    static addCustomPlayer(player: any): void;
    static removeCustomPlayers(): void;
    seekTo(seconds: number, type?: 'seconds' | 'fraction'): void;
    getCurrentTime(): number;
    getDuration(): number;
    getInternalPlayer(key?: string): any;
    showPreview(): void;
  }
} 