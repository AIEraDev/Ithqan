import React, { useEffect, useState } from "react";
import { useQueueStore } from "../store/useQueueStore";
import { usePlayerStore } from "../store/usePlayerStore";
import { quranApi, Reciter } from "../services/quranApi";

export const NowPlaying: React.FC = () => {
  const [reciters, setReciters] = useState<Reciter[]>([]);

  const {
    units,
    currentUnitIndex,
    currentAyahIndexInUnit,
    currentRepetition,
    isQueueActive,
    isGapDelaying,
    gapTimeRemaining,
    config,
    pauseQueue,
    resumeQueue,
    replayCurrentUnit,
    nextUnit,
    previousUnit,
    nextAyah,
    previousAyah,
  } = useQueueStore();

  const { status, currentTime, duration } = usePlayerStore();

  useEffect(() => {
    quranApi.getAvailableReciters().then(setReciters).catch(() => []);
  }, []);

  // Global Keyboard Shortcuts for Next/Previous Ayah & Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }

      if (!isQueueActive) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextAyah();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        previousAyah();
      } else if (e.key === " ") {
        e.preventDefault();
        if (status === "playing") pauseQueue();
        else resumeQueue();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQueueActive, status, nextAyah, previousAyah, pauseQueue, resumeQueue]);

  if (!isQueueActive) return null;

  const currentUnit = units[currentUnitIndex];
  const currentAyah = currentUnit?.ayahs[currentAyahIndexInUnit];

  const reciterName = reciters.find((r) => r.id === config.reciterId)?.name || config.reciterId;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ padding: "12px 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
      {/* Top row: label + repetition pill */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span className="text-label" style={{ color: "var(--accent)" }}>
          {isGapDelaying ? "SILENCE GAP" : "NOW PLAYING"}
        </span>
        <span className={`pill ${isGapDelaying ? "pill-warm" : "pill-accent"}`}>
          {isGapDelaying
            ? `${gapTimeRemaining.toFixed(1)}s`
            : `${currentRepetition}/${config.repeatCount}×`}
        </span>
      </div>

      {/* Surah + Ayah info */}
      {currentUnit && (
        <>
          <div className="text-value" style={{ marginBottom: 2 }}>
            {currentUnit.label}
          </div>
          {currentAyah && (
            <div className="text-meta" style={{ marginBottom: 10 }}>
              Ayah {currentAyah.surah}:{currentAyah.ayah} · Page {currentAyah.page} · <span style={{ color: "var(--text-secondary)" }}>{reciterName}</span>
            </div>
          )}
        </>
      )}

      {/* Progress bar */}
      <div className="progress-track" style={{ marginBottom: 6 }}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Time + transport row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="text-mono" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            className="transport-btn"
            onClick={previousUnit}
            disabled={currentUnitIndex === 0}
            title="Previous Unit"
            style={{ opacity: currentUnitIndex === 0 ? 0.3 : 1 }}
          >
            ⏮
          </button>
          <button
            className="transport-btn"
            onClick={previousAyah}
            title="Previous Ayah (Left Arrow)"
          >
            ◀
          </button>
          <button
            className="transport-btn"
            onClick={replayCurrentUnit}
            title="Replay Unit"
          >
            ↺
          </button>

          {status === "playing" ? (
            <button
              className="transport-btn transport-btn-primary"
              onClick={pauseQueue}
              title="Pause (Space)"
            >
              ⏸
            </button>
          ) : (
            <button
              className="transport-btn transport-btn-primary"
              onClick={resumeQueue}
              title="Resume (Space)"
            >
              ▶
            </button>
          )}

          <button
            className="transport-btn"
            onClick={nextAyah}
            title="Next Ayah (Right Arrow)"
          >
            ▶
          </button>
          <button
            className="transport-btn"
            onClick={nextUnit}
            disabled={currentUnitIndex + 1 >= units.length}
            title="Next Unit"
            style={{ opacity: currentUnitIndex + 1 >= units.length ? 0.3 : 1 }}
          >
            ⏭
          </button>
        </div>

        <span className="text-mono" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>
          {currentAyahIndexInUnit + 1}/{currentUnit?.ayahs.length || 0}
        </span>
      </div>
    </div>
  );
};
