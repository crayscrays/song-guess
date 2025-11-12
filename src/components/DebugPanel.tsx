import { useState, useEffect } from "react";
import { Bug, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DebugInfo {
  youtubeApiLoaded: boolean;
  playerInitialized: boolean;
  currentVideoId: string | null;
  playerState: string | null;
  lastError: string | null;
  containerExists: boolean;
  logs: Array<{ time: string; message: string; type: 'log' | 'error' | 'warn' }>;
}

export const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    youtubeApiLoaded: false,
    playerInitialized: false,
    currentVideoId: null,
    playerState: null,
    lastError: null,
    containerExists: false,
    logs: [],
  });

  useEffect(() => {
    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (message: string, type: 'log' | 'error' | 'warn' = 'log') => {
      setDebugInfo((prev) => ({
        ...prev,
        logs: [
          ...prev.logs.slice(-19), // Keep last 20 logs
          { time: new Date().toLocaleTimeString(), message, type },
        ],
        lastError: type === 'error' ? message : prev.lastError,
      }));
    };

    console.log = (...args: any[]) => {
      originalLog(...args);
      const message = args.map(String).join(' ');
      if (message.includes('YouTubePlayer') || message.includes('handlePlayAudio') || message.includes('Preloaded')) {
        addLog(message, 'log');
      }
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      const message = args.map(String).join(' ');
      if (message.includes('YouTubePlayer') || message.includes('handlePlayAudio') || message.includes('Error')) {
        addLog(message, 'error');
      }
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      const message = args.map(String).join(' ');
      if (message.includes('YouTubePlayer') || message.includes('handlePlayAudio') || message.includes('Failed')) {
        addLog(message, 'warn');
      }
    };

    // Update debug info periodically
    const interval = setInterval(() => {
      const container = document.getElementById('youtube-player');
      const ytApiLoaded = typeof window !== 'undefined' && !!window.YT && !!window.YT.Player;
      
      // Try to get player state if player exists
      let playerState: string | null = null;
      let playerInitialized = false;
      let currentVideoId: string | null = null;

      try {
        // Access player through window if available
        const iframe = container?.querySelector('iframe');
        if (iframe && (window as any).YT) {
          playerInitialized = true;
          // Try to get state from iframe contentWindow (may be blocked by CORS)
          try {
            const player = (iframe as any).contentWindow?.player;
            if (player) {
              const state = player.getPlayerState?.();
              const states: Record<number, string> = {
                '-1': 'UNSTARTED',
                '0': 'ENDED',
                '1': 'PLAYING',
                '2': 'PAUSED',
                '3': 'BUFFERING',
                '5': 'CUED',
              };
              playerState = states[String(state)] || `Unknown (${state})`;
            }
          } catch (e) {
            // CORS blocked, can't access iframe content
            playerState = 'Cannot access (CORS)';
          }
        }
      } catch (e) {
        // Ignore
      }

      setDebugInfo((prev) => ({
        ...prev,
        youtubeApiLoaded: ytApiLoaded,
        playerInitialized,
        containerExists: !!container,
        playerState,
        currentVideoId,
      }));
    }, 500);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      clearInterval(interval);
    };
  }, []);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 rounded-full p-2 h-auto"
        title="Open Debug Panel"
      >
        <Bug className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Debug Panel</h3>
        <Button
          onClick={() => setIsOpen(false)}
          variant="ghost"
          size="sm"
          className="h-auto p-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="font-semibold mb-1">Status:</div>
          <div className="space-y-1 pl-2">
            <div className={debugInfo.youtubeApiLoaded ? 'text-green-600' : 'text-red-600'}>
              YouTube API: {debugInfo.youtubeApiLoaded ? '✓ Loaded' : '✗ Not Loaded'}
            </div>
            <div className={debugInfo.containerExists ? 'text-green-600' : 'text-red-600'}>
              Container: {debugInfo.containerExists ? '✓ Exists' : '✗ Missing'}
            </div>
            <div className={debugInfo.playerInitialized ? 'text-green-600' : 'text-yellow-600'}>
              Player: {debugInfo.playerInitialized ? '✓ Initialized' : '? Unknown'}
            </div>
            <div>
              Player State: {debugInfo.playerState || 'Unknown'}
            </div>
            <div>
              Video ID: {debugInfo.currentVideoId || 'None'}
            </div>
            {debugInfo.lastError && debugInfo.lastError.includes('150') && (
              <div className="text-red-600 text-xs mt-2 p-2 bg-red-50 rounded">
                ⚠️ Error 150: Video doesn't allow embedding. The app will open YouTube directly.
              </div>
            )}
          </div>
        </div>

        {debugInfo.lastError && (
          <div>
            <div className="font-semibold mb-1 text-red-600">Last Error:</div>
            <div className="pl-2 text-red-500 text-xs break-words">{debugInfo.lastError}</div>
          </div>
        )}

        <div>
          <div className="font-semibold mb-1">Recent Logs:</div>
          <div className="space-y-1 pl-2 max-h-48 overflow-y-auto font-mono text-xs">
            {debugInfo.logs.length === 0 ? (
              <div className="text-muted-foreground">No logs yet...</div>
            ) : (
              debugInfo.logs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.type === 'error'
                      ? 'text-red-500'
                      : log.type === 'warn'
                        ? 'text-yellow-500'
                        : 'text-foreground'
                  }
                >
                  <span className="text-muted-foreground">[{log.time}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t space-y-2">
          <Button
            onClick={() => {
              setDebugInfo((prev) => ({ ...prev, logs: [], lastError: null }));
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Clear Logs
          </Button>
          <div className="text-xs text-muted-foreground">
            <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
            <div>Is Mobile: {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Yes' : 'No'}</div>
            <div>Container Element: {document.getElementById('youtube-player') ? 'Found' : 'Not Found'}</div>
            <div>YT Script: {document.querySelector('script[src*="youtube.com/iframe_api"]') ? 'Loaded' : 'Not Found'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

