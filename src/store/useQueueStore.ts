import { create } from "zustand";
import { queueEngine, QueueConfig, QueueUnit } from "../services/queueEngine";
import { quranApi, AyahLocation } from "../services/quranApi";
import { audioEngine } from "../services/audioEngine";
import { usePlayerStore } from "./usePlayerStore";

interface QueueState {
  config: QueueConfig;
  units: QueueUnit[];
  currentUnitIndex: number;
  currentAyahIndexInUnit: number;
  currentRepetition: number;
  isQueueActive: boolean;
  isGapDelaying: boolean;
  gapTimeRemaining: number;

  // Actions
  updateConfig: (partial: Partial<QueueConfig>) => void;
  startQueue: () => Promise<void>;
  pauseQueue: () => void;
  resumeQueue: () => void;
  stopQueue: () => void;
  replayCurrentUnit: () => Promise<void>;
  nextUnit: () => Promise<void>;
  previousUnit: () => Promise<void>;
  nextAyah: () => Promise<void>;
  previousAyah: () => Promise<void>;
  onAyahEnded: () => Promise<void>;
  loadSavedSettingsFromDb: (options?: { autoPlay?: boolean }) => Promise<void>;
  prefetchUpcomingAyahs: (lookahead?: number) => void;
}

const DEFAULT_CONFIG: QueueConfig = {
  unitType: "page",
  surahNumber: 1,
  startAyah: 1,
  endAyah: 7,
  startPage: 1,
  endPage: 1,
  repeatCount: 2,
  interRepeatGapSeconds: 1.5,
  autoAdvance: true,
  reciterId: "alafasy",
  repeatMode: "per_ayah",
};

let gapTimer: ReturnType<typeof setInterval> | null = null;

const clearGapTimer = () => {
  if (gapTimer) {
    clearInterval(gapTimer);
    gapTimer = null;
  }
};

export const useQueueStore = create<QueueState>((set, get) => ({
  config: DEFAULT_CONFIG,
  units: [],
  currentUnitIndex: 0,
  currentAyahIndexInUnit: 0,
  currentRepetition: 1,
  isQueueActive: false,
  isGapDelaying: false,
  gapTimeRemaining: 0,

  updateConfig: (partial: Partial<QueueConfig>) => {
    set((state: QueueState) => ({
      config: { ...state.config, ...partial },
    }));
  },

  loadSavedSettingsFromDb: async (options?: { autoPlay?: boolean }) => {
    try {
      const settings = await quranApi.getAllUserSettings().catch(() => []);
      const map = new Map(settings);

      const defReciter = map.get("default_reciter_id");
      const defReps = map.get("default_repeat_count");
      const defGap = map.get("default_gap_seconds");
      const defSpd = map.get("default_speed");
      const defMode = map.get("default_repeat_mode");
      const autoResumeSetting = map.get("auto_resume_on_startup");

      const shouldAutoResume = options?.autoPlay ?? (autoResumeSetting !== "false");

      const newConfig: Partial<QueueConfig> = {};
      if (defReciter) newConfig.reciterId = defReciter;
      if (defReps) newConfig.repeatCount = Number(defReps);
      if (defGap) newConfig.interRepeatGapSeconds = Number(defGap);
      if (defMode) newConfig.repeatMode = defMode as any;

      if (defSpd) {
        usePlayerStore.getState().setSpeed(Number(defSpd));
      }

      const lastSession = await quranApi.getLastSession().catch(() => null);
      if (lastSession) {
        if (lastSession.unit_type) newConfig.unitType = lastSession.unit_type as any;
        if (lastSession.surah) newConfig.surahNumber = lastSession.surah;
        if (lastSession.ayah) newConfig.startAyah = lastSession.ayah;
        if (lastSession.page) newConfig.startPage = lastSession.page;
        if (lastSession.end_page) newConfig.endPage = lastSession.end_page;
        if (lastSession.reciter_id) newConfig.reciterId = lastSession.reciter_id;
        if (lastSession.repeat_count) newConfig.repeatCount = lastSession.repeat_count;
      }

      if (Object.keys(newConfig).length > 0) {
        get().updateConfig(newConfig);
      }

      // Auto-start queue from last stopped position if auto-resume setting is enabled
      if (shouldAutoResume && lastSession && !get().isQueueActive) {
        await get().startQueue();
      }
    } catch (err) {
      console.error("Failed to load saved settings from DB:", err);
    }
  },

  prefetchUpcomingAyahs: (lookahead = 3) => {
    const { units, currentUnitIndex, currentAyahIndexInUnit, config } = get();
    if (!units || units.length === 0) return;

    const upcoming: AyahLocation[] = [];
    let u = currentUnitIndex;
    let a = currentAyahIndexInUnit + 1;

    while (upcoming.length < lookahead && u < units.length) {
      const currentUnit = units[u];
      if (currentUnit && a < currentUnit.ayahs.length) {
        upcoming.push(currentUnit.ayahs[a]);
        a++;
      } else {
        u++;
        a = 0;
      }
    }

    // Trigger async prefetch download in background and pre-buffer immediate next track
    upcoming.forEach((item, idx) => {
      quranApi.ensureAyahAudio(config.reciterId, item.surah, item.ayah).then((filePath) => {
        if (idx === 0) {
          audioEngine.preloadNextTrack(filePath);
        }
      }).catch(() => {});
    });
  },

  startQueue: async () => {
    clearGapTimer();
    const config = get().config;
    const units = await queueEngine.buildQueue(config);
    if (units.length === 0) return;

    set({
      units,
      currentUnitIndex: 0,
      currentAyahIndexInUnit: 0,
      currentRepetition: 1,
      isQueueActive: true,
      isGapDelaying: false,
      gapTimeRemaining: 0,
    });

    const firstAyah = units[0].ayahs[0];
    quranApi.saveCurrentSession({
      surah: firstAyah.surah,
      ayah: firstAyah.ayah,
      page: firstAyah.page,
      reciter_id: config.reciterId,
      unit_type: config.unitType,
      start_page: config.startPage,
      end_page: config.endPage,
      repeat_count: config.repeatCount,
      current_repetition: 1,
      updated_at: Math.floor(Date.now() / 1000),
    }).catch(console.error);

    quranApi.recordPageReview(firstAyah.page).catch(console.error);

    // Trigger prefetch for upcoming ayahs
    get().prefetchUpcomingAyahs(3);

    await usePlayerStore
      .getState()
      .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
  },

  pauseQueue: () => {
    clearGapTimer();
    set({ isGapDelaying: false });
    usePlayerStore.getState().pause();
  },

  resumeQueue: () => {
    usePlayerStore.getState().resume();
  },

  stopQueue: () => {
    clearGapTimer();
    usePlayerStore.getState().stop();
    set({
      isQueueActive: false,
      isGapDelaying: false,
      currentUnitIndex: 0,
      currentAyahIndexInUnit: 0,
      currentRepetition: 1,
    });
  },

  replayCurrentUnit: async () => {
    clearGapTimer();
    const { units, currentUnitIndex, config } = get();
    if (units.length === 0 || !units[currentUnitIndex]) return;

    set({
      currentAyahIndexInUnit: 0,
      currentRepetition: 1,
      isGapDelaying: false,
      isQueueActive: true,
    });

    get().prefetchUpcomingAyahs(3);

    const firstAyah = units[currentUnitIndex].ayahs[0];
    await usePlayerStore
      .getState()
      .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
  },

  nextUnit: async () => {
    clearGapTimer();
    const { units, currentUnitIndex, config } = get();
    if (currentUnitIndex + 1 >= units.length) return;

    const nextIdx = currentUnitIndex + 1;
    set({
      currentUnitIndex: nextIdx,
      currentAyahIndexInUnit: 0,
      currentRepetition: 1,
      isGapDelaying: false,
      isQueueActive: true,
    });

    get().prefetchUpcomingAyahs(3);

    const firstAyah = units[nextIdx].ayahs[0];
    await usePlayerStore
      .getState()
      .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
  },

  previousUnit: async () => {
    clearGapTimer();
    const { units, currentUnitIndex, config } = get();
    if (currentUnitIndex === 0) return;

    const prevIdx = currentUnitIndex - 1;
    set({
      currentUnitIndex: prevIdx,
      currentAyahIndexInUnit: 0,
      currentRepetition: 1,
      isGapDelaying: false,
      isQueueActive: true,
    });

    get().prefetchUpcomingAyahs(3);

    const firstAyah = units[prevIdx].ayahs[0];
    await usePlayerStore
      .getState()
      .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
  },

  nextAyah: async () => {
    clearGapTimer();
    const { units, currentUnitIndex, currentAyahIndexInUnit, config, isQueueActive } = get();
    if (!isQueueActive || units.length === 0) return;

    const currentUnit = units[currentUnitIndex];
    if (!currentUnit) return;

    let targetSurah = 0;
    let targetAyah = 0;

    if (currentAyahIndexInUnit + 1 < currentUnit.ayahs.length) {
      const nextAyahIdx = currentAyahIndexInUnit + 1;
      set({ currentAyahIndexInUnit: nextAyahIdx, isGapDelaying: false });
      const target = currentUnit.ayahs[nextAyahIdx];
      targetSurah = target.surah;
      targetAyah = target.ayah;
    } else if (currentUnitIndex + 1 < units.length) {
      const nextUnitIdx = currentUnitIndex + 1;
      set({
        currentUnitIndex: nextUnitIdx,
        currentAyahIndexInUnit: 0,
        currentRepetition: 1,
        isGapDelaying: false,
      });
      const target = units[nextUnitIdx].ayahs[0];
      targetSurah = target.surah;
      targetAyah = target.ayah;
    } else {
      return;
    }

    get().prefetchUpcomingAyahs(3);

    await usePlayerStore
      .getState()
      .playAyah(targetSurah, targetAyah, config.reciterId);
  },

  previousAyah: async () => {
    clearGapTimer();
    const { units, currentUnitIndex, currentAyahIndexInUnit, config, isQueueActive } = get();
    if (!isQueueActive || units.length === 0) return;

    let targetSurah = 0;
    let targetAyah = 0;

    if (currentAyahIndexInUnit > 0) {
      const prevAyahIdx = currentAyahIndexInUnit - 1;
      set({ currentAyahIndexInUnit: prevAyahIdx, isGapDelaying: false });
      const target = units[currentUnitIndex].ayahs[prevAyahIdx];
      targetSurah = target.surah;
      targetAyah = target.ayah;
    } else if (currentUnitIndex > 0) {
      const prevUnitIdx = currentUnitIndex - 1;
      const prevUnitObj = units[prevUnitIdx];
      const lastAyahIdx = prevUnitObj.ayahs.length - 1;
      set({
        currentUnitIndex: prevUnitIdx,
        currentAyahIndexInUnit: lastAyahIdx,
        currentRepetition: 1,
        isGapDelaying: false,
      });
      const target = prevUnitObj.ayahs[lastAyahIdx];
      targetSurah = target.surah;
      targetAyah = target.ayah;
    } else {
      return;
    }

    get().prefetchUpcomingAyahs(3);

    await usePlayerStore
      .getState()
      .playAyah(targetSurah, targetAyah, config.reciterId);
  },

  onAyahEnded: async () => {
    const {
      units,
      currentUnitIndex,
      currentAyahIndexInUnit,
      currentRepetition,
      config,
      isQueueActive,
    } = get();

    if (!isQueueActive || units.length === 0) return;

    const currentUnit = units[currentUnitIndex];
    if (!currentUnit) return;

    // Check if more ayahs exist in current unit
    if (currentAyahIndexInUnit + 1 < currentUnit.ayahs.length) {
      const nextAyahIdx = currentAyahIndexInUnit + 1;
      set({ currentAyahIndexInUnit: nextAyahIdx });

      get().prefetchUpcomingAyahs(3);

      const target = currentUnit.ayahs[nextAyahIdx];
      await usePlayerStore
        .getState()
        .playAyah(target.surah, target.ayah, config.reciterId);
      return;
    }

    // Finished all ayahs in the current unit iteration!
    // Check if we need to repeat this unit again:
    if (currentRepetition < config.repeatCount) {
      const nextRep = currentRepetition + 1;
      set({ currentRepetition: nextRep, currentAyahIndexInUnit: 0 });

      get().prefetchUpcomingAyahs(3);

      if (config.interRepeatGapSeconds > 0) {
        set({
          isGapDelaying: true,
          gapTimeRemaining: config.interRepeatGapSeconds,
        });

        let remaining = config.interRepeatGapSeconds;
        gapTimer = setInterval(async () => {
          remaining -= 0.1;
          set({ gapTimeRemaining: Math.max(0, remaining) });

          if (remaining <= 0) {
            clearGapTimer();
            set({ isGapDelaying: false });
            const firstAyah = currentUnit.ayahs[0];
            await usePlayerStore
              .getState()
              .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
          }
        }, 100);
      } else {
        const firstAyah = currentUnit.ayahs[0];
        await usePlayerStore
          .getState()
          .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
      }
      return;
    }

    // Finished all repetitions for current unit!
    // Auto-advance to next unit if enabled
    if (config.autoAdvance && currentUnitIndex + 1 < units.length) {
      const nextUnitIdx = currentUnitIndex + 1;
      set({
        currentUnitIndex: nextUnitIdx,
        currentAyahIndexInUnit: 0,
        currentRepetition: 1,
      });

      get().prefetchUpcomingAyahs(3);

      const nextUnitObj = units[nextUnitIdx];
      const firstAyah = nextUnitObj.ayahs[0];

      if (config.interRepeatGapSeconds > 0) {
        set({
          isGapDelaying: true,
          gapTimeRemaining: config.interRepeatGapSeconds,
        });

        let remaining = config.interRepeatGapSeconds;
        gapTimer = setInterval(async () => {
          remaining -= 0.1;
          set({ gapTimeRemaining: Math.max(0, remaining) });

          if (remaining <= 0) {
            clearGapTimer();
            set({ isGapDelaying: false });
            await usePlayerStore
              .getState()
              .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
          }
        }, 100);
      } else {
        await usePlayerStore
          .getState()
          .playAyah(firstAyah.surah, firstAyah.ayah, config.reciterId);
      }
      return;
    }

    // Queue reached the end!
    set({ isQueueActive: false });
  },
}));
