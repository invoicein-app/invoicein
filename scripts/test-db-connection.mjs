import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1);
}

const connectionString = env.DATABASE_URL;
if (!connectionString) {
  console.log("STATUS: MISSING_DATABASE_URL");
  process.exit(1);
}

const parsed = new URL(connectionString.replace(/^postgresql:\/\//, "http://"));
const password = decodeURIComponent(parsed.password || "");
const projectRef = "ewigpcdxciudwbqgwyys";

console.log("=== DATABASE_URL di .env.local ===");
console.log("Host:", parsed.hostname);
console.log("User:", decodeURIComponent(parsed.username || ""));
console.log("Password: ada (" + password.length + " karakter)");

const attempts = [
  ["direct (db.*.supabase.co)", connectionString],
  [
    "pooler session (aws-1-ap-northeast-1)",
    `postgresql://${encodeURIComponent(`postgres.${projectRef}`)}:${encodeURIComponent(password)}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`,
  ],
];

async function tryConnect(label, cs) {
  const client = new pg.Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    const now = await client.query("select now() as server_time");
    const fn = await client.query(
      "select exists(select 1 from pg_proc where proname = 'release_document_sequence') as ok"
    );
    const po = await client.query(
      "select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'po_settings') as ok"
    );
    await client.end();
    console.log("\n[" + label + "] CONNECT_OK");
    console.log("  server_time:", now.rows[0].server_time);
    console.log("  release_document_sequence:", fn.rows[0].ok ? "sudah ada" : "belum ada");
    console.log("  po_settings table:", po.rows[0].ok ? "sudah ada" : "belum ada");
    return true;
  } catch (e) {
    console.log("\n[" + label + "] GAGAL");
    console.log("  code:", e.code || "n/a");
    console.log("  message:", e.message || String(e));
    try {
      await client.end();
    } catch {}
    return false;
  }
}

let ok = false;
for (const [label, cs] of attempts) {
  if (await tryConnect(label, cs)) {
    ok = true;
    break;
  }
}

if (!ok) {
  console.log("\nOVERALL: semua percobaan gagal");
  process.exit(1);
}

console.log("\nOVERALL: koneksi berhasil");
