import React, { useEffect, useState } from "react";
import {
  Download,
  CheckCircle,
  X,
  Trash2,
  HardDrive,
  RefreshCw,
  Search,
  Zap,
  Pause,
  BarChart2,
} from "lucide-react";
import { useDownloadStore } from "../store/useDownloadStore";
import { quranApi, Surah, Reciter } from "../services/quranApi";

interface DownloadManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReleaseStats: () => void;
}

export const DownloadManager: React.FC<DownloadManagerProps> = ({
  isOpen,
  onClose,
  onOpenReleaseStats,
}) => {
  const {
    activeJob,
    surahStatuses,
    cacheStats,
    selectedReciterId,
    setSelectedReciterId,
    startSurahDownload,
    cancelCurrentDownload,
    refreshSurahStatuses,
    refreshCacheStats,
    clearCacheForReciter,
    initProgressListener,
  } = useDownloadStore();

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "cached" | "uncached">("all");
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isOpen) {
      quranApi.getSurahs().then(setSurahs).catch(console.error);
      quranApi.getAvailableReciters().then(setReciters).catch(console.error);
      refreshCacheStats();
      refreshSurahStatuses();

      initProgressListener().then((fn) => {
        unlisten = fn;
      });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec <= 0) return "0 KB/s";
    const kb = bytesPerSec / 1024;
    if (kb >= 1024) {
      return `${(kb / 1024).toFixed(2)} MB/s`;
    }
    return `${kb.toFixed(0)} KB/s`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return "0 B";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const filteredSurahs = surahs.filter((s) => {
    const matchesSearch =
      s.name_english.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name_arabic.includes(searchQuery) ||
      s.number.toString().includes(searchQuery);

    const status = surahStatuses[s.number];
    const isCached = status?.is_fully_cached;

    if (filter === "cached") return matchesSearch && isCached;
    if (filter === "uncached") return matchesSearch && !isCached;
    return matchesSearch;
  });

  const handleClearCache = async () => {
    if (confirm("Are you sure you want to clear all audio files for this reciter?")) {
      setIsClearing(true);
      await clearCacheForReciter(selectedReciterId);
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Audio Download Manager</h2>
              <p className="text-xs text-slate-400">
                Download recitations for offline Muraja'ah & practice
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReleaseStats}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition border border-slate-700"
              title="View App Release Download Analytics"
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
              Software Stats
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Storage Bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400">Reciter:</span>
            <select
              value={selectedReciterId}
              onChange={(e) => setSelectedReciterId(e.target.value)}
              className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
            >
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.bitrate})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>
                Storage Used:{" "}
                <strong className="text-white">
                  {cacheStats?.human_readable_size ?? "0 MB"}
                </strong>{" "}
                ({cacheStats?.total_files ?? 0} files)
              </span>
            </div>
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-md border border-rose-500/20 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Cache
            </button>
          </div>
        </div>

        {/* Active Download Progress Card (if job running) */}
        {activeJob && (
          <div className="mx-6 mt-4 p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-sm font-semibold text-emerald-300">
                  Downloading Surah {activeJob.surah}
                </span>
                <span className="text-xs text-slate-400">
                  (Ayah {activeJob.current_ayah} / {activeJob.total_ayahs})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {formatSpeed(activeJob.speed_bytes_per_sec)}
                </span>
                <button
                  onClick={cancelCurrentDownload}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition"
                >
                  <Pause className="w-3 h-3 text-rose-400" />
                  Cancel
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${
                    activeJob.total_ayahs > 0
                      ? Math.round((activeJob.cached_count / activeJob.total_ayahs) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>
                {Math.round((activeJob.cached_count / activeJob.total_ayahs) * 100)}% Complete
              </span>
              <span>Total Downloaded: {formatBytes(activeJob.total_bytes_downloaded)}</span>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="p-6 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Surah by name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 text-white placeholder-slate-500 text-xs pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md transition ${
                filter === "all"
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All ({surahs.length})
            </button>
            <button
              onClick={() => setFilter("cached")}
              className={`px-3 py-1 rounded-md transition ${
                filter === "cached"
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Offline Ready
            </button>
            <button
              onClick={() => setFilter("uncached")}
              className={`px-3 py-1 rounded-md transition ${
                filter === "uncached"
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Not Downloaded
            </button>
          </div>
        </div>

        {/* Surah List Table */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSurahs.map((surah) => {
              const status = surahStatuses[surah.number];
              const isFullyCached = status?.is_fully_cached;
              const cachedAyahs = status?.cached_ayahs ?? 0;
              const totalAyahs = surah.ayah_count;
              const isCurrentlyDownloading =
                activeJob?.surah === surah.number && activeJob.status === "downloading";

              return (
                <div
                  key={surah.number}
                  className="flex items-center justify-between p-3.5 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-emerald-400">
                      {surah.number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {surah.name_english}
                        </span>
                        <span className="font-arabic text-emerald-400 text-xs">
                          {surah.name_arabic}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{totalAyahs} Ayahs</span>
                        <span>•</span>
                        <span>Page {surah.start_page}</span>
                        {status && status.total_bytes > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatBytes(status.total_bytes)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isCurrentlyDownloading ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{Math.round((cachedAyahs / totalAyahs) * 100)}%</span>
                      </div>
                    ) : isFullyCached ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Ready</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => startSurahDownload(surah.number)}
                        disabled={!!activeJob && activeJob.status === "downloading"}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-lg border border-emerald-500/20 transition disabled:opacity-40"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>
                          {cachedAyahs > 0 ? `Resume (${cachedAyahs}/${totalAyahs})` : "Download"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
