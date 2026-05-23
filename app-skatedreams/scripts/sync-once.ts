import "dotenv/config";
import { runSync } from "@/lib/sync/run";

async function main() {
  const r = await runSync();
  console.log("Sync result:", r);
  process.exit(0);
}

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
