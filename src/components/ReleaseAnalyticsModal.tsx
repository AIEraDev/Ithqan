import React, { useEffect, useState } from "react";
import {
  BarChart2,
  X,
  Download,
  Apple,
  Monitor,
  Terminal,
  Globe,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { quranApi, GitHubReleaseInfo } from "../services/quranApi";

interface ReleaseAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReleaseAnalyticsModal: React.FC<ReleaseAnalyticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [releases, setReleases] = useState<GitHubReleaseInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      quranApi
        .fetchGitHubReleaseStats()
        .then((data) => {
          setReleases(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const grandTotalDownloads = releases.reduce(
    (sum, r) => sum + r.total_downloads,
    0
  );

  const getPlatformIcon = (assetName: string) => {
    const name = assetName.toLowerCase();
    if (name.endsWith(".dmg") || name.includes("macos") || name.includes("darwin")) {
      return <Apple className="w-4 h-4 text-emerald-400" />;
    }
    if (name.endsWith(".exe") || name.endsWith(".msi") || name.includes("windows")) {
      return <Monitor className="w-4 h-4 text-blue-400" />;
    }
    return <Terminal className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Software Download Analytics
              </h2>
              <p className="text-xs text-slate-400">
                Official distribution metrics across macOS, Windows, and Linux releases
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh] flex flex-col gap-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Total Downloads</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {grandTotalDownloads.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Across all public releases</p>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Active Releases</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {releases.length}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Tag versions published</p>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Privacy Status</span>
              </div>
              <div className="text-sm font-semibold text-emerald-400 mt-1">
                100% Anonymous
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Zero user tracking or PII collected</p>
            </div>
          </div>

          {/* Release List & Asset Download Counts */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
              <BarChart2 className="w-8 h-8 text-blue-400 animate-pulse mb-2" />
              <span>Fetching GitHub Release telemetry...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-white">Release Downloads by Platform</h3>
              {releases.map((rel) => (
                <div
                  key={rel.tag_name}
                  className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="text-sm font-bold text-white">{rel.name}</span>
                      <span className="ml-2 text-xs font-mono px-2 py-0.5 bg-slate-800 text-emerald-400 rounded-md border border-slate-700">
                        {rel.tag_name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Published: {new Date(rel.published_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rel.assets.map((ast) => (
                      <div
                        key={ast.name}
                        className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {getPlatformIcon(ast.name)}
                          <span className="truncate text-slate-300" title={ast.name}>
                            {ast.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 font-mono font-semibold text-emerald-400">
                          <span>{ast.download_count.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500 font-sans">dl</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
