import { runSync } from "./run";
import { env } from "@/env";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await runSync();
  } catch (err) {
    console.error("[sync.cron] error:", err);
  } finally {
    running = false;
  }
}

export function startSyncCron() {
  if (timer) return;
  setTimeout(tick, 10_000);
  timer = setInterval(tick, env.SYNC_INTERVAL_MS);
}
