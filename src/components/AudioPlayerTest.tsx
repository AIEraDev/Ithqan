import React, { useEffect, useState } from "react";
import { quranApi, Reciter, Surah } from "../services/quranApi";
import { usePlayerStore } from "../store/usePlayerStore";

export const AudioPlayerTest: React.FC = () => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [selectedAyah, setSelectedAyah] = useState<number>(1);

  const {
    surah,
    ayah,
    reciterId,
    status,
    currentTime,
    duration,
    speed,
    error,
    logs,
    setReciterId,
    playAyah,
    pause,
    resume,
    stop,
    setSpeed,
    clearLogs,
  } = usePlayerStore();

  useEffect(() => {
    quranApi.getSurahs().then(setSurahs).catch(console.error);
    quranApi.getAvailableReciters().then(setReciters).catch(console.error);
  }, []);

  const currentSurahMeta = surahs.find((s) => s.number === selectedSurah);

  const handlePlay = () => {
    playAyah(selectedSurah, selectedAyah);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-3xl mx-auto p-6 font-sans text-slate-100">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
        <header className="mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                إتقان — Ithqan
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Phase 3: Basic Playback Primitive Verification
              </p>
            </div>
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                status === "playing"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : status === "paused"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : status === "ended"
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : status === "loading"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse"
                  : status === "error"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {status}
            </span>
          </div>
        </header>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Reciter Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Reciter
            </label>
            <select
              value={reciterId}
              onChange={(e) => setReciterId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.bitrate})
                </option>
              ))}
            </select>
          </div>

          {/* Surah Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Surah
            </label>
            <select
              value={selectedSurah}
              onChange={(e) => {
                const s = Number(e.target.value);
                setSelectedSurah(s);
                setSelectedAyah(1);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {surahs.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.name_english} ({s.name_arabic})
                </option>
              ))}
            </select>
          </div>

          {/* Ayah Input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Ayah (Max: {currentSurahMeta?.ayah_count || 1})
            </label>
            <input
              type="number"
              min={1}
              max={currentSurahMeta?.ayah_count || 286}
              value={selectedAyah}
              onChange={(e) =>
                setSelectedAyah(
                  Math.max(
                    1,
                    Math.min(
                      currentSurahMeta?.ayah_count || 286,
                      Number(e.target.value) || 1
                    )
                  )
                )
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Playback Progress */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-800">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
            <span>
              {surah && ayah
                ? `Surah ${surah}, Ayah ${ayah}`
                : "No Ayah Selected"}
            </span>
            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-4">
            <div
              className="bg-emerald-400 h-full transition-all duration-150"
              style={{
                width: `${
                  duration > 0 ? (currentTime / duration) * 100 : 0
                }%`,
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePlay}
                disabled={status === "loading"}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-emerald-500/20"
              >
                {status === "playing" ? "Replay Ayah" : "Play Ayah"}
              </button>

              {status === "playing" && (
                <button
                  onClick={pause}
                  className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Pause
                </button>
              )}

              {status === "paused" && (
                <button
                  onClick={resume}
                  className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Resume
                </button>
              )}

              {(status === "playing" || status === "paused") && (
                <button
                  onClick={stop}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Stop
                </button>
              )}
            </div>

            {/* Speed Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Speed:</span>
              {[0.75, 1.0, 1.25].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeed(spd)}
                  className={`px-2.5 py-1 text-xs rounded-md border font-mono transition-colors ${
                    speed === spd
                      ? "bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
            ⚠️ {error}
          </div>
        )}

        {/* Live Event Terminal Log */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Playback Event Stream
            </span>
            <button
              onClick={clearLogs}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear Logs
            </button>
          </div>
          <div className="bg-slate-950 font-mono text-xs text-emerald-400/90 p-3 rounded-lg border border-slate-800 h-40 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <span className="text-slate-600 italic">
                No events recorded yet. Click "Play Ayah" above.
              </span>
            ) : (
              logs.map((logItem: string, idx: number) => (
                <div key={idx} className="whitespace-pre-wrap">
                  {logItem}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
