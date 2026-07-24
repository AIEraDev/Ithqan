import React, { useEffect, useState } from "react";
import { Bookmark, quranApi } from "../services/quranApi";
import { useQueueStore } from "../store/useQueueStore";
import { usePlayerStore } from "../store/usePlayerStore";

export const BookmarkManager: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(1);

  const { surah: activeSurah, ayah: activeAyah, reciterId } = usePlayerStore();
  const { updateConfig, startQueue } = useQueueStore();

  const fetchBookmarks = () => {
    quranApi.getBookmarks().then(setBookmarks).catch(console.error);
  };

  useEffect(() => { fetchBookmarks(); }, []);

  const handleAddCurrent = async () => {
    const s = activeSurah || 1;
    const a = activeAyah || 1;
    const p = await quranApi.getPageForAyah(s, a).catch(() => 1);
    const bTitle = title.trim() || `Surah ${s}:${a}`;
    await quranApi.addBookmark(bTitle, s, a, p, reciterId);
    setTitle("");
    fetchBookmarks();
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = await quranApi.getPageForAyah(surah, ayah).catch(() => 1);
    const bTitle = title.trim() || `Surah ${surah}:${ayah}`;
    await quranApi.addBookmark(bTitle, surah, ayah, p, reciterId);
    setTitle("");
    setShowForm(false);
    fetchBookmarks();
  };

  const handleLoad = async (b: Bookmark) => {
    updateConfig({
      unitType: "page",
      startPage: b.page,
      endPage: b.page,
      surahNumber: b.surah,
      startAyah: b.ayah,
      reciterId: b.reciter_id,
    });
    await startQueue();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-label">Bookmarks · {bookmarks.length}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn-ghost" style={{ fontSize: 10 }} onClick={handleAddCurrent}>
            + Current
          </button>
          <button className="btn-ghost" style={{ fontSize: 10 }} onClick={() => setShowForm(!showForm)}>
            + Custom
          </button>
        </div>
      </div>

      {/* ── Add Form ── */}
      {showForm && (
        <form onSubmit={handleAddCustom} className="surface-card" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="surface-input"
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" min={1} max={114} value={surah} onChange={(e) => setSurah(Number(e.target.value) || 1)} className="surface-input" style={{ flex: 1 }} placeholder="Surah" />
            <input type="number" min={1} value={ayah} onChange={(e) => setAyah(Number(e.target.value) || 1)} className="surface-input" style={{ flex: 1 }} placeholder="Ayah" />
            <button type="submit" className="btn-ghost" style={{ fontSize: 10, whiteSpace: "nowrap" }}>Add</button>
          </div>
        </form>
      )}

      {/* ── List ── */}
      {bookmarks.length === 0 ? (
        <div className="text-meta" style={{ textAlign: "center", padding: 20, fontSize: 11 }}>
          No saved bookmarks yet
        </div>
      ) : (
        <div className="custom-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
          {bookmarks.map((b) => (
            <div
              key={b.id}
              className="surface-card"
              style={{
                padding: "8px 10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="text-value" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {b.title}
                </div>
                <div className="text-meta" style={{ fontSize: 9 }}>
                  {b.surah}:{b.ayah} · P.{b.page} · {b.reciter_id}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button className="btn-ghost" style={{ fontSize: 10, color: "var(--accent)" }} onClick={() => handleLoad(b)}>
                  ▶
                </button>
                <button className="btn-ghost" style={{ fontSize: 10, color: "var(--text-tertiary)" }} onClick={() => { quranApi.deleteBookmark(b.id); fetchBookmarks(); }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
