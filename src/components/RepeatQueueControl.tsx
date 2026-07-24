import React, { useEffect, useState } from "react";
import { quranApi, Reciter, Surah } from "../services/quranApi";
import { UnitType, RepeatMode } from "../services/queueEngine";
import { useQueueStore } from "../store/useQueueStore";
import { usePlayerStore } from "../store/usePlayerStore";

export const RepeatQueueControl: React.FC = () => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);

  const {
    config,
    units,
    isQueueActive,
    updateConfig,
    startQueue,
    stopQueue,
  } = useQueueStore();

  const { speed, setSpeed } = usePlayerStore();

  useEffect(() => {
    quranApi.getSurahs().then(setSurahs).catch(console.error);
    quranApi.getAvailableReciters().then(setReciters).catch(console.error);
  }, []);

  const activeSurahMeta = surahs.find((s) => s.number === config.surahNumber);

  const unitTypes: { id: UnitType; label: string }[] = [
    { id: "ayah", label: "Ayah" },
    { id: "ayah_range", label: "Range" },
    { id: "page", label: "Page" },
    { id: "page_range", label: "Pages" },
    { id: "surah", label: "Surah" },
  ];

  const repeatModes: { id: RepeatMode; label: string }[] = [
    { id: "per_ayah", label: "Ayah" },
    { id: "per_page", label: "Page" },
    { id: "per_page_chunk", label: "Chunk" },
    { id: "per_block", label: "Block" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Unit Type Selector ── */}
      <div>
        <div className="text-label" style={{ marginBottom: 6 }}>Unit Type</div>
        <div className="seg-group">
          {unitTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => updateConfig({ unitType: t.id })}
              className={`seg-item ${config.unitType === t.id ? "seg-item-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Boundaries ── */}
      <div className="surface-card" style={{ padding: 12 }}>
        <div className="text-label" style={{ marginBottom: 8 }}>Configuration</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Reciter */}
          <div>
            <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Reciter</label>
            <select
              value={config.reciterId}
              onChange={(e) => updateConfig({ reciterId: e.target.value })}
              className="surface-input"
              style={{ width: "100%" }}
            >
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Surah selector */}
          {(config.unitType === "ayah" || config.unitType === "ayah_range" || config.unitType === "surah") && (
            <div>
              <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Surah</label>
              <select
                value={config.surahNumber}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  updateConfig({ surahNumber: s, startAyah: 1, endAyah: 1 });
                }}
                className="surface-input"
                style={{ width: "100%" }}
              >
                {surahs.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.number}. {s.name_english}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ayah inputs */}
          {config.unitType === "ayah" && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>
                  Ayah (1–{activeSurahMeta?.ayah_count || 286})
                </label>
                <input
                  type="number"
                  min={1}
                  max={activeSurahMeta?.ayah_count || 286}
                  value={config.startAyah}
                  onChange={(e) => updateConfig({ startAyah: Number(e.target.value) || 1 })}
                  className="surface-input"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}

          {config.unitType === "ayah_range" && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Start</label>
                <input
                  type="number"
                  min={1}
                  max={activeSurahMeta?.ayah_count || 286}
                  value={config.startAyah}
                  onChange={(e) => updateConfig({ startAyah: Number(e.target.value) || 1 })}
                  className="surface-input"
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>End</label>
                <input
                  type="number"
                  min={config.startAyah}
                  max={activeSurahMeta?.ayah_count || 286}
                  value={config.endAyah}
                  onChange={(e) => updateConfig({ endAyah: Number(e.target.value) || 1 })}
                  className="surface-input"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}

          {/* Page inputs */}
          {config.unitType === "page" && (
            <div>
              <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Mushaf Page (1–604)</label>
              <input
                type="number"
                min={1}
                max={604}
                value={config.startPage}
                onChange={(e) => updateConfig({ startPage: Number(e.target.value) || 1 })}
                className="surface-input"
                style={{ width: "100%" }}
              />
            </div>
          )}

          {config.unitType === "page_range" && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Start Page</label>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={config.startPage}
                  onChange={(e) => updateConfig({ startPage: Number(e.target.value) || 1 })}
                  className="surface-input"
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>End Page</label>
                <input
                  type="number"
                  min={config.startPage}
                  max={604}
                  value={config.endPage}
                  onChange={(e) => updateConfig({ endPage: Number(e.target.value) || 1 })}
                  className="surface-input"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Loop Settings ── */}
      <div className="surface-card" style={{ padding: 12 }}>
        <div className="text-label" style={{ marginBottom: 8 }}>Loop Settings</div>

        {/* Loop Pattern */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="text-meta" style={{ fontSize: 10 }}>Pattern</label>
            <span className="text-meta" style={{ fontSize: 10, color: "var(--accent)" }}>
              {(config.repeatMode || "per_ayah") === "per_ayah"
                ? "Repeat Ayah by Ayah"
                : config.repeatMode === "per_page"
                ? "Repeat Page by Page"
                : config.repeatMode === "per_page_chunk"
                ? `Repeat Chunks of ${config.chunkPageSize || 2} Pages`
                : "Repeat Entire Block"}
            </span>
          </div>
          <div className="seg-group">
            {repeatModes.map((m) => (
              <button
                key={m.id}
                onClick={() => updateConfig({ repeatMode: m.id })}
                className={`seg-item ${(config.repeatMode || "per_ayah") === m.id ? "seg-item-active" : ""}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chunk Size Selector (if per_page_chunk) */}
        {config.repeatMode === "per_page_chunk" && (
          <div style={{ marginBottom: 10 }}>
            <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>
              Pages Per Chunk · <span style={{ color: "var(--accent)", fontWeight: 600 }}>{config.chunkPageSize || 2} Pages</span>
            </label>
            <div className="seg-group">
              {[2, 3, 5, 10].map((size) => (
                <button
                  key={size}
                  onClick={() => updateConfig({ chunkPageSize: size })}
                  className={`seg-item ${(config.chunkPageSize || 2) === size ? "seg-item-active" : ""}`}
                >
                  {size} Pages
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reps */}
        <div style={{ marginBottom: 10 }}>
          <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>
            Repetitions · <span style={{ color: "var(--accent)", fontWeight: 600 }}>{config.repeatCount}×</span>
          </label>
          <div className="seg-group">
            {[1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => updateConfig({ repeatCount: n })}
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
            <label className="text-meta" style={{ fontSize: 10 }}>Silence Gap</label>
            <span className="text-mono" style={{ color: "var(--accent-warm)", fontSize: 10 }}>
              {config.interRepeatGapSeconds}s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={config.interRepeatGapSeconds}
            onChange={(e) => updateConfig({ interRepeatGapSeconds: Number(e.target.value) })}
          />
        </div>

        {/* Speed */}
        <div style={{ marginBottom: 10 }}>
          <label className="text-meta" style={{ display: "block", marginBottom: 4, fontSize: 10 }}>Speed</label>
          <div className="seg-group">
            {[0.75, 1.0, 1.25].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={`seg-item ${speed === spd ? "seg-item-active" : ""}`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <span className="text-meta" style={{ fontSize: 11 }}>Auto-advance to next unit</span>
            <input
              type="checkbox"
              checked={config.autoAdvance}
              onChange={(e) => updateConfig({ autoAdvance: e.target.checked })}
              style={{ width: 16, height: 16 }}
            />
          </label>
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <span className="text-meta" style={{ fontSize: 11, color: "var(--accent)" }}>Smart retention bias</span>
            <input
              type="checkbox"
              checked={!!config.smartRetentionOrder}
              onChange={(e) => updateConfig({ smartRetentionOrder: e.target.checked })}
              style={{ width: 16, height: 16 }}
            />
          </label>
        </div>
      </div>

      {/* ── Start / Stop Button ── */}
      {isQueueActive ? (
        <button onClick={stopQueue} className="btn-primary" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
          ■ Stop Queue
        </button>
      ) : (
        <button onClick={startQueue} className="btn-primary">
          ▶ Start Muraja'ah
        </button>
      )}

      {/* ── Queue Preview ── */}
      {units.length > 0 && (
        <div className="surface-card" style={{ padding: 12 }}>
          <div className="text-label" style={{ marginBottom: 6 }}>Queue · {units.length} units</div>
          <div className="custom-scrollbar" style={{ maxHeight: 100, overflowY: "auto" }}>
            {units.slice(0, 20).map((u, idx) => {
              const isCurrent = idx === useQueueStore.getState().currentUnitIndex;
              return (
                <div
                  key={u.unitIndex}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "var(--radius-btn)",
                    marginBottom: 2,
                    fontSize: 11,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isCurrent ? "var(--accent-muted)" : "transparent",
                    color: isCurrent ? "var(--accent)" : "var(--text-secondary)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  <span>{u.label}</span>
                  {isCurrent && <span className="pill pill-accent">CURRENT</span>}
                </div>
              );
            })}
            {units.length > 20 && (
              <div className="text-meta" style={{ textAlign: "center", padding: 4 }}>
                +{units.length - 20} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
