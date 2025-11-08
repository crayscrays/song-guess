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

  constructor(containerId: string) {
    this.containerId = containerId;
    this.readyPromise = this.initializeAPI();
  }

  private initializeAPI(): Promise<void> {
    return new Promise((resolve) => {
      // Check if API is already loaded
      if (window.YT && window.YT.Player) {
        this.isReady = true;
        resolve();
        return;
      }

      // Load YouTube IFrame API
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Set up callback for when API is ready
      window.onYouTubeIframeAPIReady = () => {
        this.isReady = true;
        resolve();
      };
    });
  }

  async loadVideo(videoId: string): Promise<void> {
    await this.readyPromise;

    return new Promise((resolve) => {
      this.player = new window.YT.Player(this.containerId, {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => resolve(),
          onError: (event: any) => {
            console.error('YouTube player error:', event.data);
          },
        },
      });
    });
  }

  async playSegment(startTime: number, duration: number): Promise<void> {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    return new Promise((resolve) => {
      this.player.seekTo(startTime, true);
      this.player.playVideo();

      setTimeout(() => {
        this.player.pauseVideo();
        resolve();
      }, duration * 1000);
    });
  }

  destroy() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }
}
