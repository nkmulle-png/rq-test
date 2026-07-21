// scripts/inject-runtime-env.mjs
import { writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Adjust path based on your framework's build output directory
const CONFIG_PATH = join(process.cwd(), ".output", "public", "env-config.js");

// This MUST match the exact size of the file generated in Step 1
const TARGET_BYTES = 2048; 

console.log(`[Env Injector] Starting injection...`);

try {
  // 1. Gather variables (add any new ones here)
  const envData = {
    SUPABASE_URL: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim(),
    SUPABASE_PUBLISHABLE_KEY: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim()
  };

  // 2. Safely stringify to escape all quotes/newlines, and add comment padding prefix
  let content = `window.__RUNTIME_ENV__ = ${JSON.stringify(envData, null, 2)};\n// PADDING: `;

  // 3. Pad the string with asterisks until it hits the exact target byte size
  content = content.padEnd(TARGET_BYTES, '*');

  // 4. Overwrite the file in the build output
  writeFileSync(CONFIG_PATH, content);
  
  const stats = statSync(CONFIG_PATH);
  console.log(`✅ Runtime env generated! File size is exactly: ${stats.size} bytes`);
} catch (error) {
  console.error("❌ Failed to generate runtime variables:", error);
  process.exit(1);
}
