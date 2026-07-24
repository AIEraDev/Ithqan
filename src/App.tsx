import { useEffect, useState } from "react";
import { NowPlaying } from "./components/NowPlaying";
import { RepeatQueueControl } from "./components/RepeatQueueControl";
import { ReviewStatusHeatmap } from "./components/ReviewStatusHeatmap";
import { SettingsView } from "./components/SettingsView";
import { ResumeBanner } from "./components/ResumeBanner";
import { BookmarkManager } from "./components/BookmarkManager";
import { DownloadManager } from "./components/DownloadManager";
import { ReleaseAnalyticsModal } from "./components/ReleaseAnalyticsModal";
import { initTrayAndHotkeyListeners } from "./services/trayListener";
import { useQueueStore } from "./store/useQueueStore";
import { usePlayerStore } from "./store/usePlayerStore";
import { useDownloadStore } from "./store/useDownloadStore";
import { Download, RefreshCw } from "lucide-react";
import "./index.css";

type Tab = "looper" | "review" | "bookmarks" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("looper");
  const { isQueueActive, loadSavedSettingsFromDb, resumeQueue } = useQueueStore();
  const {
    isDownloadManagerOpen,
    setDownloadManagerOpen,
    isReleaseStatsOpen,
    setReleaseStatsOpen,
    activeJob,
  } = useDownloadStore();

  useEffect(() => {
    initTrayAndHotkeyListeners();
    loadSavedSettingsFromDb();

    // Auto-Resume on System Wake from Sleep / Window Focus
    const handleWakeOrFocus = () => {
      const active = useQueueStore.getState().isQueueActive;
      const status = usePlayerStore.getState().status;

      if (active && status === "paused") {
        resumeQueue();
      }
    };

    window.addEventListener("focus", handleWakeOrFocus);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleWakeOrFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleWakeOrFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: "looper", icon: "🎧", label: "Looper" },
    { id: "review", icon: "📊", label: "Review" },
    { id: "bookmarks", icon: "🔖", label: "Saved" },
    { id: "settings", icon: "⚙️", label: "More" },
  ];

  return (
    <div
      className="popover-shell"
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "var(--radius-shell)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-popover)",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          height: 44,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isQueueActive ? "var(--accent)" : "var(--text-tertiary)",
              transition: "background 0.2s ease",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Ithqan
          </span>
          <span className="text-arabic" style={{ fontSize: 12 }}>
            إتقان
          </span>
        </div>

        <button
          onClick={() => setDownloadManagerOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition border border-slate-700/80 relative"
          title="Open Audio & Offline Download Manager"
        >
          {activeJob && activeJob.status === "downloading" ? (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Downloads</span>
          {activeJob && activeJob.status === "downloading" && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
          )}
        </button>
      </header>

      {/* ── Now Playing (always visible during playback) ── */}
      <NowPlaying />

      {/* ── Main Content ── */}
      <main
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {activeTab === "looper" && (
          <div style={{ padding: 16 }}>
            <ResumeBanner />
            <RepeatQueueControl />
          </div>
        )}
        {activeTab === "review" && (
          <div style={{ padding: 16 }}>
            <ReviewStatusHeatmap />
          </div>
        )}
        {activeTab === "bookmarks" && (
          <div style={{ padding: 16 }}>
            <BookmarkManager />
          </div>
        )}
        {activeTab === "settings" && (
          <div style={{ padding: 16 }}>
            <SettingsView />
          </div>
        )}
      </main>

      {/* Modals */}
      <DownloadManager
        isOpen={isDownloadManagerOpen}
        onClose={() => setDownloadManagerOpen(false)}
        onOpenReleaseStats={() => setReleaseStatsOpen(true)}
      />

      <ReleaseAnalyticsModal
        isOpen={isReleaseStatsOpen}
        onClose={() => setReleaseStatsOpen(false)}
      />

      {/* ── Bottom Navigation Bar ── */}
      <nav
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 12px",
              borderRadius: "var(--radius-btn)",
              transition: "color 0.1s ease",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-tertiary)",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: activeTab === tab.id ? 600 : 500,
                letterSpacing: "0.02em",
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
