import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import {
  quranApi,
  DownloadProgressPayload,
  SurahDownloadStatus,
  CacheStats,
} from "../services/quranApi";

interface DownloadStoreState {
  isDownloadManagerOpen: boolean;
  isReleaseStatsOpen: boolean;
  activeJob: DownloadProgressPayload | null;
  surahStatuses: Record<number, SurahDownloadStatus>;
  cacheStats: CacheStats | null;
  selectedReciterId: string;
  isListening: boolean;

  // Actions
  setDownloadManagerOpen: (open: boolean) => void;
  setReleaseStatsOpen: (open: boolean) => void;
  setSelectedReciterId: (reciterId: string) => void;
  startSurahDownload: (surahNumber: number) => Promise<void>;
  cancelCurrentDownload: () => Promise<void>;
  refreshSurahStatuses: (surahNumbers?: number[]) => Promise<void>;
  refreshCacheStats: () => Promise<void>;
  clearCacheForReciter: (reciterId?: string) => Promise<void>;
  initProgressListener: () => Promise<() => void>;
}

export const useDownloadStore = create<DownloadStoreState>((set, get) => ({
  isDownloadManagerOpen: false,
  isReleaseStatsOpen: false,
  activeJob: null,
  surahStatuses: {},
  cacheStats: null,
  selectedReciterId: "alafasy",
  isListening: false,

  setDownloadManagerOpen: (open: boolean) => {
    set({ isDownloadManagerOpen: open });
    if (open) {
      get().refreshCacheStats();
      get().refreshSurahStatuses();
    }
  },

  setReleaseStatsOpen: (open: boolean) => set({ isReleaseStatsOpen: open }),

  setSelectedReciterId: (reciterId: string) => {
    set({ selectedReciterId: reciterId });
    get().refreshSurahStatuses();
  },

  refreshCacheStats: async () => {
    try {
      const stats = await quranApi.getCacheStats();
      set({ cacheStats: stats });
    } catch (e) {
      console.error("Failed to fetch cache stats:", e);
    }
  },

  refreshSurahStatuses: async (surahNumbers?: number[]) => {
    const { selectedReciterId } = get();
    const surahsToFetch = surahNumbers ?? Array.from({ length: 114 }, (_, i) => i + 1);

    try {
      const results = await Promise.all(
        surahsToFetch.map((s) => quranApi.getSurahDownloadStatus(selectedReciterId, s))
      );
      set((state) => {
        const next = { ...state.surahStatuses };
        results.forEach((res) => {
          next[res.surah] = res;
        });
        return { surahStatuses: next };
      });
    } catch (e) {
      console.error("Failed to refresh surah download statuses:", e);
    }
  },

  startSurahDownload: async (surahNumber: number) => {
    const { selectedReciterId, activeJob } = get();
    if (activeJob && activeJob.status === "downloading") {
      console.warn("A download job is already running");
      return;
    }

    const jobId = `job-${Date.now()}-${surahNumber}`;
    try {
      await quranApi.downloadSurahBatch(selectedReciterId, surahNumber, jobId);
    } catch (e) {
      console.error("Failed to initiate batch download:", e);
    }
  },

  cancelCurrentDownload: async () => {
    const { activeJob } = get();
    if (activeJob) {
      await quranApi.cancelDownloadJob(activeJob.job_id);
      set({ activeJob: null });
      get().refreshSurahStatuses([activeJob.surah]);
    }
  },

  clearCacheForReciter: async (reciterId?: string) => {
    try {
      await quranApi.clearCache(reciterId);
      await get().refreshCacheStats();
      await get().refreshSurahStatuses();
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }
  },

  initProgressListener: async () => {
    if (get().isListening) return () => {};
    set({ isListening: true });

    try {
      const unlisten = await listen<DownloadProgressPayload>(
        "download-progress",
        (event) => {
          const payload = event.payload;
          set({ activeJob: payload });

          // Update Surah status dynamically
          if (payload.status === "completed" || payload.status === "cancelled") {
            get().refreshSurahStatuses([payload.surah]);
            get().refreshCacheStats();
            if (payload.status === "completed") {
              setTimeout(() => {
                if (get().activeJob?.job_id === payload.job_id) {
                  set({ activeJob: null });
                }
              }, 2000);
            }
          }
        }
      );
      return unlisten;
    } catch (e) {
      console.error("Failed to setup download listener (web preview mode?):", e);
      set({ isListening: false });
      return () => {};
    }
  },
}));
