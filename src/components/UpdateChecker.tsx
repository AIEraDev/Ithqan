import React, { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const UpdateChecker: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for updates 3 seconds after launch
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (update) {
          setUpdateAvailable(true);
          setUpdateVersion(update.version);
        }
      } catch (e) {
        // Silently ignore update check failures (offline, etc.)
        console.debug("Update check skipped:", e);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    try {
      setDownloading(true);
      setError(null);
      setProgress("Downloading...");

      const update = await check();
      if (!update) return;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          setProgress(`Downloading (${(event.data.contentLength / 1024 / 1024).toFixed(1)} MB)...`);
        } else if (event.event === "Finished") {
          setProgress("Installing...");
        }
      });

      setProgress("Restarting...");
      await relaunch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setDownloading(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div
      style={{
        padding: "10px 16px",
        background: "var(--accent-muted)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>
          {downloading ? progress : `Update v${updateVersion} available`}
        </div>
        {error && (
          <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 2 }}>{error}</div>
        )}
      </div>
      {!downloading && (
        <button
          onClick={handleUpdate}
          style={{
            padding: "4px 10px",
            fontSize: 10,
            fontWeight: 600,
            background: "var(--accent)",
            color: "#0C0E12",
            border: "none",
            borderRadius: "var(--radius-btn)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Update Now
        </button>
      )}
    </div>
  );
};
