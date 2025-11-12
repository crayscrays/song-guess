// YouTube IFrame Player API wrapper
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export class YouTubePlayer {
  private player: any = null;
  private isReady = false;
  private readyPromise: Promise<void>;
  private containerId: string;
  private currentVideoId: string | null = null;
  private playerReadyPromise: Promise<void> | null = null;
  private resolvePlayerReady: (() => void) | null = null;
  private pendingCueResolve: (() => void) | null = null;
  private pendingCueReject: ((error: unknown) => void) | null = null;

  constructor(containerId: string) {
    this.containerId = containerId;
    console.log('YouTubePlayer: Initializing with container:', containerId);
    this.readyPromise = this.initializeAPI();
  }

  private initializeAPI(): Promise<void> {
    return new Promise((resolve) => {
      console.log('YouTubePlayer: Checking if YT API is loaded');
      
      // Check if API is already loaded
      if (window.YT && window.YT.Player) {
        console.log('YouTubePlayer: YT API already loaded');
        this.isReady = true;
        resolve();
        return;
      }

      // Load YouTube IFrame API
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        console.log('YouTubePlayer: Loading YT IFrame API script');
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Set up callback for when API is ready
      const originalCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTubePlayer: YT API ready callback fired');
        this.isReady = true;
        if (originalCallback) originalCallback();
        resolve();
      };
    });
  }

  private async ensurePlayer(videoId: string): Promise<void> {
    await this.readyPromise;

    if (this.player) {
      return;
    }

    this.playerReadyPromise = new Promise<void>((resolve) => {
      this.resolvePlayerReady = resolve;
    });

    this.player = new window.YT.Player(this.containerId, {
      height: '0',
      width: '0',
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          console.log('YouTubePlayer: Player ready event fired');
          this.currentVideoId = videoId;
          this.resolvePlayerReady?.();
          this.resolvePlayerReady = null;
        },
        onError: (event: any) => {
          console.error('YouTubePlayer: Player error:', event.data);
          if (this.pendingCueReject) {
            this.pendingCueReject(new Error(`YouTube player error: ${event.data}`));
            this.resetPendingCue();
          }
        },
        onStateChange: (event: any) => {
          console.log('YouTubePlayer: State changed to:', event.data);
          if (
            this.pendingCueResolve &&
            window.YT &&
            typeof window.YT.PlayerState !== 'undefined' &&
            event.data === window.YT.PlayerState.CUED
          ) {
            this.pendingCueResolve();
            this.resetPendingCue();
          }
        },
      },
    });

    if (this.playerReadyPromise) {
      await this.playerReadyPromise;
      this.playerReadyPromise = null;
    }
  }

  private resetPendingCue() {
    this.pendingCueResolve = null;
    this.pendingCueReject = null;
  }

  async loadVideo(videoId: string): Promise<void> {
    console.log('YouTubePlayer: loadVideo called with:', videoId);

    if (!videoId) {
      return;
    }

    await this.ensurePlayer(videoId);

    // If we already have this video loaded, skip reloading
    if (this.currentVideoId === videoId) {
      console.log('YouTubePlayer: Video already loaded, skipping');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.pendingCueResolve = () => {
        this.currentVideoId = videoId;
        resolve();
      };
      this.pendingCueReject = reject;

      try {
        console.log('YouTubePlayer: Cueing video', videoId);
        this.player.cueVideoById(videoId, 0);
      } catch (error) {
        console.error('YouTubePlayer: Error cueing video:', error);
        this.resetPendingCue();
        reject(error);
        return;
      }

      setTimeout(() => {
        if (this.pendingCueResolve) {
          console.log('YouTubePlayer: Cue fallback resolve after timeout');
          this.pendingCueResolve();
          this.resetPendingCue();
        }
      }, 1500);
    });
  }

  async playSegment(startTime: number, duration: number): Promise<void> {
    console.log('YouTubePlayer: playSegment called, start:', startTime, 'duration:', duration);
    
    if (!this.player) {
      const error = 'Player not initialized';
      console.error('YouTubePlayer:', error);
      throw new Error(error);
    }

    return new Promise((resolve) => {
      try {
        console.log('YouTubePlayer: Seeking to', startTime);
        this.player.seekTo(startTime, true);
        
        console.log('YouTubePlayer: Starting playback');
        this.player.playVideo();

        setTimeout(() => {
          console.log('YouTubePlayer: Pausing after', duration, 'seconds');
          this.player.pauseVideo();
          resolve();
        }, duration * 1000);
      } catch (error) {
        console.error('YouTubePlayer: Error in playSegment:', error);
        resolve();
      }
    });
  }

  destroy() {
    console.log('YouTubePlayer: Destroying player');
    if (this.player) {
      this.player.destroy();
      this.player = null;
      this.currentVideoId = null;
      this.playerReadyPromise = null;
      this.resolvePlayerReady = null;
      this.resetPendingCue();
    }
  }
}
