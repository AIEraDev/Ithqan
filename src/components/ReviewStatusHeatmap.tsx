import React, { useEffect, useState } from "react";
import { quranApi, PageReview } from "../services/quranApi";
import { retentionScheduler, RetentionStats } from "../services/retentionScheduler";
import { useQueueStore } from "../store/useQueueStore";

export const ReviewStatusHeatmap: React.FC = () => {
  const [reviews, setReviews] = useState<Map<number, PageReview>>(new Map());
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  const { updateConfig, startQueue } = useQueueStore();

  const loadData = async () => {
    const map = await retentionScheduler.getReviewMap();
    setReviews(map);
    const s = await retentionScheduler.getRetentionStats();
    setStats(s);
  };

  useEffect(() => { loadData(); }, []);

  const nowSecs = Math.floor(Date.now() / 1000);

  const getPageColor = (p: number) => {
    const r = reviews.get(p);
    if (!r || r.last_reviewed_at === 0) return "#3B1C1C"; // rose-ish dark
    const days = (nowSecs - r.last_reviewed_at) / 86400;
    if (days <= 3) return "#0D3B2E"; // emerald dark
    if (days <= 10) return "#3B2E0D"; // amber dark
    return "#3B1C1C"; // overdue
  };

  const getPageInfo = (p: number) => {
    const r = reviews.get(p);
    if (!r || r.last_reviewed_at === 0) return { label: "Never reviewed", days: null, count: 0 };
    const days = ((nowSecs - r.last_reviewed_at) / 86400).toFixed(1);
    return { label: `${days}d ago`, days, count: r.review_count };
  };

  const handleQueueDue = async () => {
    const allPages = Array.from({ length: 604 }, (_, i) => i + 1);
    const duePages = await retentionScheduler.prioritizePages(allPages);
    const top10 = duePages.slice(0, 10);
    const startP = Math.min(...top10);
    const endP = Math.max(...top10);
    updateConfig({
      unitType: "page_range",
      startPage: startP,
      endPage: endP,
      smartRetentionOrder: true,
      repeatCount: 2,
    });
    await startQueue();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Stats Row ── */}
      {stats && (
        <div style={{ display: "flex", gap: 8 }}>
          <div className="surface-card" style={{ flex: 1, padding: "10px 12px" }}>
            <div className="text-label" style={{ marginBottom: 2 }}>Coverage</div>
            <div className="text-value" style={{ color: "var(--accent)", fontSize: 16 }}>
              {stats.coveragePercentage.toFixed(0)}%
            </div>
            <div className="text-meta" style={{ fontSize: 9 }}>{stats.totalPagesCovered}/604</div>
          </div>
          <div className="surface-card" style={{ flex: 1, padding: "10px 12px" }}>
            <div className="text-label" style={{ marginBottom: 2 }}>Due</div>
            <div className="text-value" style={{ color: "var(--danger)", fontSize: 16 }}>
              {stats.duePagesCount}
            </div>
            <div className="text-meta" style={{ fontSize: 9 }}>pages overdue</div>
          </div>
          <div className="surface-card" style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: "#0D3B2E", display: "inline-block" }} />
              <span className="text-meta" style={{ fontSize: 9 }}>≤3d</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: "#3B2E0D", display: "inline-block" }} />
              <span className="text-meta" style={{ fontSize: 9 }}>4-10d</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: "#3B1C1C", display: "inline-block" }} />
              <span className="text-meta" style={{ fontSize: 9 }}>Due</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Queue Due Button ── */}
      <button onClick={handleQueueDue} className="btn-primary" style={{ padding: "8px 12px", fontSize: 11 }}>
        ▶ Queue Top Due Pages
      </button>

      {/* ── 604-Page Grid ── */}
      <div
        className="surface-card custom-scrollbar"
        style={{ padding: 8, maxHeight: 240, overflowY: "auto" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(20, 1fr)",
            gap: 1,
          }}
        >
          {Array.from({ length: 604 }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPage(selectedPage === p ? null : p)}
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: 2,
                border: selectedPage === p ? "1px solid var(--accent)" : "none",
                background: getPageColor(p),
                cursor: "pointer",
                fontSize: 0,
                padding: 0,
                transition: "transform 0.1s ease",
                transform: selectedPage === p ? "scale(1.4)" : "scale(1)",
                zIndex: selectedPage === p ? 10 : 1,
                position: "relative",
              }}
              title={`Page ${p}`}
            />
          ))}
        </div>
      </div>

      {/* ── Selected Page Detail ── */}
      {selectedPage && (
        <div className="surface-card" style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="text-value" style={{ fontSize: 12 }}>Page {selectedPage}</div>
            <div className="text-meta" style={{ fontSize: 10 }}>
              {getPageInfo(selectedPage).count > 0
                ? `${getPageInfo(selectedPage).count} reviews · ${getPageInfo(selectedPage).label}`
                : "Never reviewed"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn-ghost"
              style={{ fontSize: 10 }}
              onClick={async () => {
                await quranApi.recordPageReview(selectedPage);
                loadData();
              }}
            >
              Mark Done
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: 10, color: "var(--text-tertiary)" }}
              onClick={() => setSelectedPage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
