import { create } from "zustand";
import { audioEngine, PlaybackStatus } from "../services/audioEngine";
import { quranApi } from "../services/quranApi";

interface PlayerState {
  surah: number | null;
  ayah: number | null;
  reciterId: string;
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
  error: string | null;
  logs: string[];

  // Actions
  setReciterId: (reciterId: string) => void;
  playAyah: (surah: number, ayah: number, customReciterId?: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setSpeed: (speed: number) => void;
  clearLogs: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  // Attach audioEngine callbacks
  audioEngine.setCallbacks({
    onStatusChange: (status: PlaybackStatus) => {
      set((state: PlayerState) => ({
        status,
        logs: [...state.logs, `[STATUS] ${status}`].slice(-50),
      }));
    },
    onTimeUpdate: (currentTime: number, duration: number) => {
      set({ currentTime, duration });
      if (duration > 0 && duration - currentTime <= 5.0) {
        import("./useQueueStore").then((mod) => {
          mod.useQueueStore.getState().prefetchUpcomingAyahs(3);
        });
      }
    },
    onEnded: () => {
      set((state: PlayerState) => ({
        logs: [...state.logs, `[ENDED] Ayah ${state.surah}:${state.ayah} finished`].slice(-50),
      }));
      // Trigger queue loop engine
      import("./useQueueStore").then((mod) => {
        mod.useQueueStore.getState().onAyahEnded();
      });
    },
    onError: (errorMsg: string) => {
      set((state: PlayerState) => ({
        error: errorMsg,
        status: "error",
        logs: [...state.logs, `[ERROR] ${errorMsg}`].slice(-50),
      }));
    },
  });

  return {
    surah: null,
    ayah: null,
    reciterId: "alafasy",
    status: "idle",
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    speed: 1.0,
    error: null,
    logs: [],

    setReciterId: (reciterId: string) => set({ reciterId }),

    playAyah: async (surah: number, ayah: number, customReciterId?: string) => {
      const activeReciter = customReciterId || get().reciterId;
      set((state: PlayerState) => ({
        surah,
        ayah,
        reciterId: activeReciter,
        error: null,
        logs: [
          ...state.logs,
          `[FETCH_AUDIO] Surah ${surah}:${ayah} (${activeReciter})...`,
        ].slice(-50),
      }));

      try {
        const filePath = await quranApi.ensureAyahAudio(activeReciter, surah, ayah);
        set((state: PlayerState) => ({
          logs: [...state.logs, `[CACHED_FILE] ${filePath}`].slice(-50),
        }));
        await audioEngine.loadAndPlay(filePath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set((state: PlayerState) => ({
          error: msg,
          status: "error",
          logs: [...state.logs, `[FETCH_ERROR] ${msg}`].slice(-50),
        }));
      }
    },

    pause: () => {
      audioEngine.pause();
    },

    resume: () => {
      audioEngine.resume();
    },

    stop: () => {
      audioEngine.stop();
      set({ surah: null, ayah: null, currentTime: 0, duration: 0 });
    },

    setVolume: (volume: number) => {
      audioEngine.setVolume(volume);
      set({ volume });
    },

    setSpeed: (speed: number) => {
      audioEngine.setSpeed(speed);
      set({ speed });
    },

    clearLogs: () => set({ logs: [] }),
  };
});
