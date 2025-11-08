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

  async loadVideo(videoId: string): Promise<void> {
    console.log('YouTubePlayer: loadVideo called with:', videoId);
    
    // If we already have this video loaded, skip reloading
    if (this.currentVideoId === videoId && this.player) {
      console.log('YouTubePlayer: Video already loaded, skipping');
      return;
    }

    await this.readyPromise;
    console.log('YouTubePlayer: API ready, creating player');

    return new Promise((resolve, reject) => {
      try {
        // Destroy existing player if any
        if (this.player) {
          console.log('YouTubePlayer: Destroying existing player');
          this.player.destroy();
        }

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
            onReady: (event: any) => {
              console.log('YouTubePlayer: Player ready event fired');
              this.currentVideoId = videoId;
              resolve();
            },
            onError: (event: any) => {
              console.error('YouTubePlayer: Player error:', event.data);
              reject(new Error(`YouTube player error: ${event.data}`));
            },
            onStateChange: (event: any) => {
              console.log('YouTubePlayer: State changed to:', event.data);
            }
          },
        });
      } catch (error) {
        console.error('YouTubePlayer: Error creating player:', error);
        reject(error);
      }
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
    }
  }
}
