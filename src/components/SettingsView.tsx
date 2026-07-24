import React, { useEffect, useState } from "react";
import { CacheStats, quranApi, Reciter } from "../services/quranApi";
import { useQueueStore } from "../store/useQueueStore";
import { usePlayerStore } from "../store/usePlayerStore";
import { useDownloadStore } from "../store/useDownloadStore";

export const SettingsView: React.FC = () => {
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [saved, setSaved] = useState(false);
  const [autoResume, setAutoResume] = useState(true);

  const { config, updateConfig } = useQueueStore();
  const { setSpeed, speed } = usePlayerStore();

  const loadData = async () => {
    const r = await quranApi.getAvailableReciters().catch(() => []);
    setReciters(r);
    const stats = await quranApi.getCacheStats().catch(() => null);
    setCacheStats(stats);

    const settings = await quranApi.getAllUserSettings().catch(() => []);
    const map = new Map(settings);

    const defReciter = map.get("default_reciter_id");
    const defReps = map.get("default_repeat_count");
    const defGap = map.get("default_gap_seconds");
    const defSpd = map.get("default_speed");
    const defMode = map.get("default_repeat_mode");
    const autoRes = map.get("auto_resume_on_startup");

    if (autoRes !== undefined) {
      setAutoResume(autoRes !== "false");
    }

    if (defReciter || defReps || defGap || defMode) {
      updateConfig({
        reciterId: defReciter || config.reciterId,
        repeatCount: defReps ? Number(defReps) : config.repeatCount,
        interRepeatGapSeconds: defGap ? Number(defGap) : config.interRepeatGapSeconds,
        repeatMode: (defMode as any) || config.repeatMode,
      });
    }
    if (defSpd) setSpeed(Number(defSpd));
  };

  useEffect(() => { loadData(); }, []);

  const save = async (key: string, value: string) => {
    await quranApi.saveUserSetting(key, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearCache = async () => {
    if (window.confirm("Are you sure you want to clear cached audio files?")) {
      await quranApi.clearCache().catch(console.error);
      const stats = await quranApi.getCacheStats().catch(() => null);
      setCacheStats(stats);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Save Toast ── */}
      {saved && (
        <div className="pill pill-accent" style={{ alignSelf: "flex-start", fontSize: 10 }}>
          ✓ Saved
        </div>
      )}

      {/* ── Preferences ── */}
      <div className="surface-card" style={{ padding: 12 }}>
        <div className="text-label" style={{ marginBottom: 10 }}>Defaults</div>

        {/* Reciter */}
        <div style={{ marginBottom: 10 }}>
          <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Reciter</label>
          <select
            value={config.reciterId}
            onChange={(e) => { updateConfig({ reciterId: e.target.value }); save("default_reciter_id", e.target.value); }}
            className="surface-input"
            style={{ width: "100%" }}
          >
            {reciters.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div style={{ marginBottom: 10 }}>
          <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Playback Speed</label>
          <div className="seg-group">
            {[0.75, 1.0, 1.25].map((spd) => (
              <button
                key={spd}
                onClick={() => { setSpeed(spd); save("default_speed", String(spd)); }}
                className={`seg-item ${speed === spd ? "seg-item-active" : ""}`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>

        {/* Reps */}
        <div style={{ marginBottom: 10 }}>
          <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Default Reps</label>
          <div className="seg-group">
            {[1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => { updateConfig({ repeatCount: n }); save("default_repeat_count", String(n)); }}
                className={`seg-item ${config.repeatCount === n ? "seg-item-active" : ""}`}
              >
                {n}×
              </button>
            ))}
          </div>
        </div>

        {/* Gap */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="text-meta" style={{ fontSize: 10 }}>Default Gap</label>
            <span className="text-mono" style={{ color: "var(--accent-warm)", fontSize: 10 }}>{config.interRepeatGapSeconds}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={config.interRepeatGapSeconds}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ interRepeatGapSeconds: val });
              save("default_gap_seconds", String(val));
            }}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>

        {/* Auto Resume Toggle */}
        <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="text-value" style={{ fontSize: 11 }}>Auto-play on Startup & Wake</div>
            <div className="text-meta" style={{ fontSize: 9, marginTop: 2 }}>Resume recitation from last stopped position on startup or system wake</div>
          </div>
          <input
            type="checkbox"
            checked={autoResume}
            onChange={(e) => {
              setAutoResume(e.target.checked);
              save("auto_resume_on_startup", String(e.target.checked));
            }}
            style={{ accentColor: "var(--accent)", cursor: "pointer", width: 14, height: 14 }}
          />
        </div>
      </div>

      {/* ── Offline Cache & Download Management ── */}
      <div className="surface-card" style={{ padding: 12 }}>
        <div className="text-label" style={{ marginBottom: 8 }}>Audio Storage & Download Center</div>
        {cacheStats ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="text-value">{cacheStats.total_files} files</div>
                <div className="text-meta">{(cacheStats.total_bytes / (1024 * 1024)).toFixed(1)} MB total space</div>
              </div>
              <button onClick={handleClearCache} className="btn-ghost" style={{ fontSize: 11, color: "var(--accent-warm)" }}>
                Clear Storage
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <button
                onClick={() => useDownloadStore.getState().setDownloadManagerOpen(true)}
                className="btn-accent"
                style={{ flex: 1, fontSize: 11, padding: "6px 12px" }}
              >
                📥 Open Download Center
              </button>
              <button
                onClick={() => useDownloadStore.getState().setReleaseStatsOpen(true)}
                className="btn-secondary"
                style={{ flex: 1, fontSize: 11, padding: "6px 12px" }}
              >
                📊 Software Stats
              </button>
            </div>
          </div>
        ) : (
          <div className="text-meta">Calculating storage...</div>
        )}
      </div>

      {/* ── Keyboard Shortcuts ── */}
      <div className="surface-card" style={{ padding: 12 }}>
        <div className="text-label" style={{ marginBottom: 8 }}>Keyboard Shortcuts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-meta">Play / Pause</span>
            <span className="text-mono" style={{ color: "var(--accent)" }}>Space</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-meta">Next / Prev Ayah</span>
            <span className="text-mono" style={{ color: "var(--accent)" }}>→ / ←</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-meta">Next / Prev Unit</span>
            <span className="text-mono" style={{ color: "var(--accent)" }}>Shift + → / ←</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-meta">Toggle Panel</span>
            <span className="text-mono" style={{ color: "var(--accent)" }}>Option + Space</span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 12 }}>
        <div className="text-meta" style={{ fontSize: 10 }}>Ithqan (إتقان) v0.1.0 · Quran Review Engine</div>
      </div>
    </div>
  );
};
