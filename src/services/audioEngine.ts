import { convertFileSrc } from "@tauri-apps/api/core";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface AudioEngineCallbacks {
  onStatusChange?: (status: PlaybackStatus) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (errorMsg: string) => void;
}

class AudioEngine {
  private playerA: HTMLAudioElement | null = null;
  private playerB: HTMLAudioElement | null = null;
  private activeTag: "A" | "B" = "A";
  private callbacks: AudioEngineCallbacks = {};
  private currentStatus: PlaybackStatus = "idle";
  private currentVolume = 1.0;
  private currentSpeed = 1.0;
  private preloadedPath: string | null = null;

  constructor() {
    this.initPlayers();
  }

  private initPlayers() {
    if (typeof window === "undefined") return;

    this.playerA = new Audio();
    this.playerB = new Audio();

    [this.playerA, this.playerB].forEach((player, idx) => {
      const tag = idx === 0 ? "A" : "B";
      player.preload = "auto";

      player.addEventListener("playing", () => {
        if (this.activeTag === tag) {
          this.setStatus("playing");
        }
      });

      player.addEventListener("pause", () => {
        if (this.activeTag === tag && this.currentStatus !== "ended") {
          this.setStatus("paused");
        }
      });

      player.addEventListener("ended", () => {
        if (this.activeTag === tag) {
          this.setStatus("ended");
          if (this.callbacks.onEnded) {
            this.callbacks.onEnded();
          }
        }
      });

      player.addEventListener("timeupdate", () => {
        if (this.activeTag === tag && this.callbacks.onTimeUpdate) {
          this.callbacks.onTimeUpdate(player.currentTime, player.duration || 0);
        }
      });

      player.addEventListener("error", () => {
        if (this.activeTag === tag) {
          const errorMsg = player.error?.message || "Audio playback error";
          this.setStatus("error");
          if (this.callbacks.onError) {
            this.callbacks.onError(errorMsg);
          }
        }
      });
    });
  }

  private getActivePlayer(): HTMLAudioElement {
    if (!this.playerA || !this.playerB) this.initPlayers();
    return this.activeTag === "A" ? this.playerA! : this.playerB!;
  }

  private getStandbyPlayer(): HTMLAudioElement {
    if (!this.playerA || !this.playerB) this.initPlayers();
    return this.activeTag === "A" ? this.playerB! : this.playerA!;
  }

  public setCallbacks(callbacks: AudioEngineCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /// Pre-buffers the next audio file on the standby player's decoder into RAM memory
  public preloadNextTrack(filePath: string): void {
    if (!filePath) return;
    try {
      const standby = this.getStandbyPlayer();
      const src = convertFileSrc(filePath);
      if (standby.src !== src) {
        standby.src = src;
        standby.volume = this.currentVolume;
        standby.playbackRate = this.currentSpeed;
        standby.load(); // Decode initial audio frames into memory buffer
        this.preloadedPath = filePath;
      }
    } catch {
      // Ignore pre-buffer errors silently
    }
  }

  public async loadAndPlay(filePath: string): Promise<void> {
    if (!this.playerA || !this.playerB) this.initPlayers();

    const currentActive = this.getActivePlayer();

    // Check if the requested file was already pre-buffered on the standby player
    if (this.preloadedPath === filePath) {
      const standby = this.getStandbyPlayer();

      // Pause current active player
      currentActive.pause();
      currentActive.currentTime = 0;

      // Swap active tag to standby player
      this.activeTag = this.activeTag === "A" ? "B" : "A";
      this.preloadedPath = null;

      try {
        this.setStatus("loading");
        standby.volume = this.currentVolume;
        standby.playbackRate = this.currentSpeed;
        await standby.play();
        return;
      } catch {
        // Fallback to normal loading if instant swap failed
      }
    }

    // Standard load path (if not pre-buffered)
    try {
      this.setStatus("loading");
      currentActive.pause();
      const src = convertFileSrc(filePath);
      currentActive.src = src;
      currentActive.volume = this.currentVolume;
      currentActive.playbackRate = this.currentSpeed;
      await currentActive.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus("error");
      if (this.callbacks.onError) {
        this.callbacks.onError(msg);
      }
    }
  }

  public pause(): void {
    const active = this.getActivePlayer();
    if (!active.paused) {
      active.pause();
    }
  }

  public async resume(): Promise<void> {
    const active = this.getActivePlayer();
    if (active.paused && active.src) {
      try {
        await active.play();
      } catch {
        this.setStatus("error");
      }
    }
  }

  public stop(): void {
    if (this.playerA) {
      this.playerA.pause();
      this.playerA.currentTime = 0;
    }
    if (this.playerB) {
      this.playerB.pause();
      this.playerB.currentTime = 0;
    }
    this.preloadedPath = null;
    this.setStatus("idle");
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.playerA) this.playerA.volume = this.currentVolume;
    if (this.playerB) this.playerB.volume = this.currentVolume;
  }

  public setSpeed(speed: number): void {
    this.currentSpeed = Math.max(0.5, Math.min(2.0, speed));
    if (this.playerA) this.playerA.playbackRate = this.currentSpeed;
    if (this.playerB) this.playerB.playbackRate = this.currentSpeed;
  }

  public getCurrentStatus(): PlaybackStatus {
    return this.currentStatus;
  }

  private setStatus(status: PlaybackStatus) {
    this.currentStatus = status;
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(status);
    }
  }
}

export const audioEngine = new AudioEngine();
