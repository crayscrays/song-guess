// YouTube IFrame Player API wrapper
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

// YouTube error codes
const YOUTUBE_ERROR_CODES: Record<number, string> = {
  2: 'Invalid video ID',
  5: 'HTML5 player error',
  100: 'Video not found',
  101: 'Video not allowed in embedded players',
  150: 'Video does not allow embedding',
};

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
  private embeddingErrors: Set<string> = new Set(); // Track videos that don't allow embedding

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

    // Ensure container element exists
    const container = document.getElementById(this.containerId);
    if (!container) {
      throw new Error(`YouTube player container not found: ${this.containerId}`);
    }

    this.playerReadyPromise = new Promise<void>((resolve) => {
      this.resolvePlayerReady = resolve;
    });

    this.player = new window.YT.Player(this.containerId, {
      height: '1',
      width: '1',
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          console.log('YouTubePlayer: Player ready event fired');
          this.currentVideoId = videoId;
          this.resolvePlayerReady?.();
          this.resolvePlayerReady = null;
        },
        onError: (event: any) => {
          const errorCode = event.data;
          const errorMessage = YOUTUBE_ERROR_CODES[errorCode] || `Unknown error (${errorCode})`;
          console.error(`YouTubePlayer: Player error ${errorCode}: ${errorMessage}`);
          
          // Track embedding errors (150 = embedding not allowed)
          if (errorCode === 150 || errorCode === 101) {
            if (this.currentVideoId) {
              this.embeddingErrors.add(this.currentVideoId);
              console.warn(`YouTubePlayer: Video ${this.currentVideoId} does not allow embedding`);
            }
          }
          
          if (this.pendingCueReject) {
            const error = new Error(`YouTube player error ${errorCode}: ${errorMessage}`);
            (error as any).code = errorCode;
            (error as any).videoId = this.currentVideoId;
            this.pendingCueReject(error);
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

    // Check if we already know this video doesn't allow embedding
    if (this.embeddingErrors.has(videoId)) {
      const error = new Error(`Video ${videoId} does not allow embedding (error 150)`);
      (error as any).code = 150;
      (error as any).videoId = videoId;
      throw error;
    }

    await this.ensurePlayer(videoId);

    // If we already have this video loaded, verify it's ready
    if (this.currentVideoId === videoId) {
      console.log('YouTubePlayer: Video already loaded, verifying ready state');
      // Wait a bit to ensure player is ready
      await new Promise(resolve => setTimeout(resolve, 50));
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.pendingCueResolve = () => {
        this.currentVideoId = videoId;
        console.log('YouTubePlayer: Video cued successfully');
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

      // Fallback timeout - resolve even if CUED event doesn't fire
      setTimeout(() => {
        if (this.pendingCueResolve) {
          console.log('YouTubePlayer: Cue fallback resolve after timeout');
          this.currentVideoId = videoId;
          this.pendingCueResolve();
          this.resetPendingCue();
        }
      }, 2000);
    });
  }

  // Preload a video in the background (non-blocking)
  // Note: YouTube API only allows one video cued at a time, so this will replace any previously cued video
  async preloadVideo(videoId: string): Promise<void> {
    if (!videoId) {
      return;
    }

    try {
      await this.readyPromise;
      
      // If player doesn't exist yet, create it with this video
      if (!this.player) {
        await this.ensurePlayer(videoId);
        return;
      }

      // If this video is already loaded, skip
      if (this.currentVideoId === videoId) {
        return;
      }

      // Cue the video in the background (non-blocking)
      // This will replace any previously cued video, but that's fine for preloading
      try {
        this.player.cueVideoById(videoId, 0);
        // Update currentVideoId after a short delay to allow cue to complete
        setTimeout(() => {
          this.currentVideoId = videoId;
        }, 100);
      } catch (error) {
        console.warn('YouTubePlayer: Error preloading video', videoId, error);
      }
    } catch (error) {
      console.warn('YouTubePlayer: Error in preloadVideo', videoId, error);
    }
  }

  async playSegment(startTime: number, duration: number): Promise<void> {
    console.log('YouTubePlayer: playSegment called, start:', startTime, 'duration:', duration);
    console.log('YouTubePlayer: Player exists?', !!this.player);
    console.log('YouTubePlayer: Current video ID:', this.currentVideoId);
    
    if (!this.player) {
      const error = 'Player not initialized';
      console.error('YouTubePlayer:', error);
      console.error('YouTubePlayer: Container element:', document.getElementById(this.containerId));
      console.error('YouTubePlayer: YT API available?', !!window.YT);
      throw new Error(error);
    }

    // Log player methods availability
    try {
      console.log('YouTubePlayer: Player methods available:', {
        playVideo: typeof this.player.playVideo === 'function',
        pauseVideo: typeof this.player.pauseVideo === 'function',
        seekTo: typeof this.player.seekTo === 'function',
        getPlayerState: typeof this.player.getPlayerState === 'function',
      });
    } catch (e) {
      console.warn('YouTubePlayer: Could not check player methods:', e);
    }

    return new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 15; // Increased retries for mobile (15 * 100ms = 1.5s)
      let playbackStarted = false;
      
      try {
        // Ensure player is ready
        const checkReady = () => {
          try {
            const playerState = this.player.getPlayerState();
            console.log('YouTubePlayer: Current player state:', playerState);
            
            // States: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            // We want CUED (5) or UNSTARTED (-1) or PAUSED (2) before playing
            if (playerState === 5 || playerState === -1 || playerState === 2 || playerState === 0) {
              console.log('YouTubePlayer: Seeking to', startTime);
              try {
                this.player.seekTo(startTime, true);
              } catch (seekError) {
                console.warn('YouTubePlayer: Seek error (may be normal):', seekError);
              }
              
              // Small delay after seek before playing
              setTimeout(() => {
                try {
                  console.log('YouTubePlayer: Starting playback');
                  this.player.playVideo();
                  playbackStarted = true;
                  
                  // Verify playback started
                  setTimeout(() => {
                    const newState = this.player.getPlayerState();
                    if (newState === 1) {
                      console.log('YouTubePlayer: Playback confirmed started');
                    } else {
                      console.warn('YouTubePlayer: Playback may not have started, state:', newState);
                      // On mobile, sometimes state doesn't immediately change to playing
                      // but audio still plays, so we don't reject here
                    }
                  }, 300);
                } catch (playError) {
                  console.error('YouTubePlayer: Error calling playVideo:', playError);
                  reject(new Error(`Failed to play video: ${playError}`));
                }
              }, 150);
            } else if (playerState === 1) {
              // Already playing, just seek
              console.log('YouTubePlayer: Already playing, seeking to', startTime);
              try {
                this.player.seekTo(startTime, true);
                playbackStarted = true;
              } catch (seekError) {
                console.warn('YouTubePlayer: Seek error:', seekError);
              }
            } else if (retryCount < maxRetries) {
              retryCount++;
              console.log(`YouTubePlayer: Player not ready (state: ${playerState}), retrying (${retryCount}/${maxRetries})...`);
              setTimeout(checkReady, 100);
              return;
            } else {
              // Max retries reached, try to play anyway
              console.warn('YouTubePlayer: Max retries reached, attempting to play anyway');
              try {
                this.player.seekTo(startTime, true);
                setTimeout(() => {
                  try {
                    this.player.playVideo();
                    playbackStarted = true;
                  } catch (e) {
                    console.error('YouTubePlayer: Error in fallback play:', e);
                    reject(new Error(`Failed to play video after retries: ${e}`));
                  }
                }, 100);
              } catch (e) {
                console.error('YouTubePlayer: Error in fallback seek/play:', e);
                reject(new Error(`Failed to play video: ${e}`));
              }
            }
          } catch (error) {
            console.error('YouTubePlayer: Error checking player state:', error);
            // Try to play anyway
            try {
              this.player.seekTo(startTime, true);
              setTimeout(() => {
                try {
                  this.player.playVideo();
                  playbackStarted = true;
                } catch (e) {
                  console.error('YouTubePlayer: Error in fallback play:', e);
                  reject(new Error(`Failed to play video: ${e}`));
                }
              }, 100);
            } catch (e) {
              console.error('YouTubePlayer: Error in fallback play:', e);
              reject(new Error(`Failed to play video: ${e}`));
            }
          }
        };
        
        checkReady();

        // Set up pause timeout
        const pauseTimeout = setTimeout(() => {
          console.log('YouTubePlayer: Pausing after', duration, 'seconds');
          try {
            if (this.player) {
              this.player.pauseVideo();
            }
          } catch (error) {
            console.error('YouTubePlayer: Error pausing video:', error);
          }
          resolve();
        }, duration * 1000);
      } catch (error) {
        console.error('YouTubePlayer: Error in playSegment:', error);
        reject(error);
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
