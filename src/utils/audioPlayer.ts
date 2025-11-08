// Simple audio player utility using Web Audio API
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Play a tone for demonstration purposes
  // In production, this would load and play actual audio files
  async playTone(duration: number): Promise<void> {
    if (!this.audioContext) return;

    return new Promise((resolve) => {
      // Create oscillator for tone generation
      this.oscillator = this.audioContext!.createOscillator();
      this.gainNode = this.audioContext!.createGain();

      // Configure the tone (A4 note = 440 Hz)
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(440, this.audioContext!.currentTime);

      // Configure volume with fade in/out
      this.gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext!.currentTime + 0.1);
      this.gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext!.currentTime + duration - 0.1);
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + duration);

      // Connect nodes
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext!.destination);

      // Play the tone
      this.oscillator.start(this.audioContext!.currentTime);
      this.oscillator.stop(this.audioContext!.currentTime + duration);

      // Resolve when finished
      setTimeout(() => {
        this.cleanup();
        resolve();
      }, duration * 1000);
    });
  }

  // Play actual audio file (for when you add real songs)
  async playAudioFile(url: string, duration: number): Promise<void> {
    if (!this.audioContext) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(0.7, this.audioContext.currentTime);
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Play for specified duration
      source.start(0);
      
      return new Promise((resolve) => {
        setTimeout(() => {
          source.stop();
          resolve();
        }, duration * 1000);
      });
    } catch (error) {
      console.error('Error playing audio file:', error);
    }
  }

  private cleanup() {
    if (this.oscillator) {
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  dispose() {
    this.cleanup();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
