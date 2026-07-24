import React, { useEffect, useState } from "react";
import { quranApi, SessionState, Reciter } from "../services/quranApi";
import { useQueueStore } from "../store/useQueueStore";
import { UnitType } from "../services/queueEngine";

export const ResumeBanner: React.FC = () => {
  const [lastSession, setLastSession] = useState<SessionState | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const { updateConfig, startQueue } = useQueueStore();

  useEffect(() => {
    quranApi.getLastSession().then((session) => {
      if (session) setLastSession(session);
    }).catch(console.error);

    quranApi.getAvailableReciters().then(setReciters).catch(console.error);
  }, []);

  if (!lastSession || dismissed) return null;

  const reciterName = reciters.find((r) => r.id === lastSession.reciter_id)?.name || lastSession.reciter_id;

  const handleResume = async () => {
    updateConfig({
      unitType: (lastSession.unit_type as UnitType) || "page",
      surahNumber: lastSession.surah,
      startAyah: lastSession.ayah,
      startPage: lastSession.page,
      endPage: lastSession.end_page || lastSession.page,
      repeatCount: lastSession.repeat_count || 2,
      reciterId: lastSession.reciter_id || "alafasy",
    });
    setDismissed(true);
    await startQueue();
  };

  return (
    <div
      className="surface-card"
      style={{
        padding: 12,
        marginBottom: 12,
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div className="text-label" style={{ color: "var(--accent)", marginBottom: 4 }}>
            Resume Session
          </div>
          <div className="text-value" style={{ fontSize: 12 }}>
            Surah {lastSession.surah}:{lastSession.ayah} · Page {lastSession.page}
          </div>
          <div className="text-meta" style={{ fontSize: 10, marginTop: 2 }}>
            {reciterName} · {lastSession.unit_type} · {lastSession.repeat_count}× reps
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={handleResume}
          className="btn-primary"
          style={{ padding: "8px 12px", fontSize: 11, flex: 1 }}
        >
          ▶ Resume
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="btn-ghost"
          style={{ flex: 0 }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
