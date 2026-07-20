import { readdirSync, readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const REPLACEMENTS = {
  __RUNTIME_SUPABASE_URL__: process.env.SUPABASE_URL ?? "",
  __RUNTIME_SUPABASE_PUBLISHABLE_KEY__: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
};

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
    } else if (/\.(m?js|html)$/.test(entry)) {
      let content = readFileSync(path, "utf8");
      let changed = false;
      for (const [token, value] of Object.entries(REPLACEMENTS)) {
        if (content.includes(token)) {
          content = content.replaceAll(token, value);
          changed = true;
        }
      }
      if (changed) {
        // atomic write: temp file + rename, so a mid-write kill (OOM etc.)
        // can't leave a truncated/corrupted file behind
        const tmpPath = `${path}.tmp`;
        writeFileSync(tmpPath, content);
        renameSync(tmpPath, path);
      }
    }
  }
}

walk(".output");
