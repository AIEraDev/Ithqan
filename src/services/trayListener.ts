import { listen } from "@tauri-apps/api/event";
import { useQueueStore } from "../store/useQueueStore";
import { usePlayerStore } from "../store/usePlayerStore";

export function initTrayAndHotkeyListeners() {
  listen<string>("tray-action", (event) => {
    const action = event.payload;
    const { status } = usePlayerStore.getState();
    const queueStore = useQueueStore.getState();

    switch (action) {
      case "play_pause":
        if (status === "playing") {
          queueStore.pauseQueue();
        } else if (status === "paused") {
          queueStore.resumeQueue();
        } else {
          queueStore.startQueue();
        }
        break;

      case "replay_unit":
        queueStore.replayCurrentUnit();
        break;

      case "next_unit":
        queueStore.nextUnit();
        break;

      case "prev_unit":
        queueStore.previousUnit();
        break;

      default:
        break;
    }
  }).catch((err) => console.error("Failed to listen for tray-action:", err));
}
