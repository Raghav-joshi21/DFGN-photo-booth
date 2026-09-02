#!/usr/bin/env node
/**
 * Supabase setup verifier.
 *
 * Run `pnpm check:supabase` after filling in .env.local and applying
 * supabase/migrations/0001_init.sql. It proves the pieces the app depends on
 * are actually in place — including that Row Level Security behaves the way
 * the migration intends, which is the part that silently goes wrong.
 *
 * Reads .env.local directly (no dotenv dependency).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env parser: KEY=VALUE, ignoring comments and optional quotes. */
function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = { ...loadEnv(path.join(ROOT, ".env.local")), ...process.env };

let failures = 0;
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m, hint) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
  if (hint) console.log(`      \x1b[2m→ ${hint}\x1b[0m`);
};

console.log("\nChecking Supabase setup\n");

// --- 1. Environment --------------------------------------------------------
console.log("Environment (.env.local)");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

const placeholder = (v) => !v || v.includes("your-") || v.includes("your_");

if (placeholder(url)) {
  fail("NEXT_PUBLIC_SUPABASE_URL missing or still a placeholder", "Settings → Data API → Project URL");
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  fail(`NEXT_PUBLIC_SUPABASE_URL looks wrong: ${url}`, "Expected https://<project-ref>.supabase.co");
} else pass("NEXT_PUBLIC_SUPABASE_URL");

if (placeholder(anon)) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY missing or still a placeholder", "Settings → API Keys → anon / public");
else pass("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (placeholder(service)) fail("SUPABASE_SERVICE_ROLE_KEY missing or still a placeholder", "Settings → API Keys → service_role (keep secret)");
else if (service === anon) fail("SUPABASE_SERVICE_ROLE_KEY is the same as the anon key", "Copy the service_role key, not the anon one");
else pass("SUPABASE_SERVICE_ROLE_KEY");

if (failures) {
  console.log(`\n\x1b[31m${failures} problem(s).\x1b[0m Fix .env.local, then re-run.\n`);
  process.exit(1);
}

const db = createClient(url, anon);
const admin = createClient(url, service, { auth: { persistSession: false } });

// --- 2. Table + read policy ------------------------------------------------
console.log("\nDatabase");
const { error: readErr } = await db
  .from("photos")
  .select("id,source,original_url,edited_url,status,created_at")
  .limit(1);

if (readErr) {
  const missing = /does not exist|schema cache|relation/i.test(readErr.message);
  fail(
    `cannot read the photos table: ${readErr.message}`,
    missing
      ? "The migration hasn't been applied. Paste supabase/migrations/0001_init.sql into the SQL Editor and run it."
      : undefined,
  );
} else {
  pass("photos table exists and is readable with the anon key");
}

// --- 3. RLS behaviour ------------------------------------------------------
// These are the rules the app leans on. A misapplied migration usually still
// creates the table, so testing the policies is what actually catches it.
console.log("\nRow Level Security");
const probeUrl = `https://example.invalid/rls-probe-${Date.now()}.jpg`;

// IMPORTANT: no `.select()` on these inserts. PostgREST turns .select() into a
// RETURNING clause, and Postgres enforces the SELECT policy on returned rows —
// a 'pending' row is invisible under ours, so the insert reports
// "new row violates row-level security policy" even though it succeeded.
// Testing with .select() therefore makes a WORKING setup look broken.
const { error: insertPendingErr } = await db
  .from("photos")
  .insert({ source: "upload", original_url: probeUrl, status: "pending" });

const canInsert = !insertPendingErr;
if (canInsert) {
  pass("anon CAN insert a 'pending' photo (guest upload works)");
} else {
  fail(`anon cannot insert a 'pending' photo: ${insertPendingErr.message}`, 'Check the "guests can submit pending uploads" policy.');
}

const { error: insertApprovedErr } = await db
  .from("photos")
  .insert({ source: "upload", original_url: `${probeUrl}#approved`, status: "approved" });

if (!insertApprovedErr) {
  fail("anon was able to insert an 'approved' photo — moderation is bypassable!", "The insert policy's WITH CHECK must force status = 'pending'.");
} else if (canInsert) {
  // Only meaningful as a pass when inserts work at all; otherwise everything
  // is blocked and this tells us nothing.
  pass("anon CANNOT self-insert an 'approved' photo (blocked, as intended)");
} else {
  console.log("  \x1b[2m·\x1b[0m approved-insert also blocked — inconclusive while all inserts fail");
}

// Approving an existing row must be server-side only.
const { data: seeded } = await admin
  .from("photos")
  .insert({ source: "upload", original_url: `${probeUrl}#upd`, status: "pending" })
  .select("id")
  .single();
if (seeded) {
  const { data: updated } = await db
    .from("photos")
    .update({ status: "approved" })
    .eq("id", seeded.id)
    .select("id");
  if (!updated || updated.length === 0) pass("anon CANNOT update status (server-side only, as intended)");
  else fail("anon was able to approve a photo — moderation is bypassable!", "Remove any UPDATE policy on public.photos.");
}

// --- 4. Storage ------------------------------------------------------------
console.log("\nStorage");
const { data: buckets, error: bucketErr } = await admin.storage.listBuckets();
if (bucketErr) {
  fail(`cannot list buckets: ${bucketErr.message}`);
} else {
  const photos = buckets.find((b) => b.id === "photos");
  if (!photos) fail("no 'photos' bucket", "The migration creates it. Re-run the SQL, or add it under Storage → New bucket (public).");
  else if (!photos.public) fail("'photos' bucket is not public", "The booth wall renders images by URL. Storage → photos → make public.");
  else pass("'photos' bucket exists and is public");
}

// --- 4b. End-to-end guest upload ------------------------------------------
// Exercises the exact path app/upload uses: anon uploads a file to Storage,
// then inserts a pending row referencing its public URL.
console.log("\nGuest upload path (end to end)");
const objectPath = `upload/check-${Date.now()}.txt`;
const { error: upErr } = await db.storage
  .from("photos")
  .upload(objectPath, new Blob(["setup check"], { type: "text/plain" }), {
    contentType: "text/plain",
  });
if (upErr) {
  fail(`anon cannot upload to the photos bucket: ${upErr.message}`, 'Check the "guests can upload photos" storage policy.');
} else {
  const { data: pub } = db.storage.from("photos").getPublicUrl(objectPath);
  const { error: rowErr } = await db
    .from("photos")
    .insert({ id: crypto.randomUUID(), source: "upload", original_url: pub.publicUrl, status: "pending" });
  if (rowErr) fail(`uploaded the file but could not insert its row: ${rowErr.message}`);
  else pass("uploaded a file and inserted its pending row (the real flow works)");
  await admin.storage.from("photos").remove([objectPath]);
}

// --- 5. Realtime -----------------------------------------------------------
console.log("\nRealtime");
await new Promise((resolve) => {
  const channel = db.channel("setup-check");
  const timer = setTimeout(() => {
    fail("Realtime did not connect within 10s", "Check Database → Replication that 'photos' is in the supabase_realtime publication.");
    db.removeChannel(channel);
    resolve();
  }, 10000);

  channel
    .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, () => {})
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        pass("subscribed to photos changes (the live wall will update)");
        db.removeChannel(channel);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        fail(`Realtime subscription failed: ${status}`, "Check that 'photos' is in the supabase_realtime publication.");
        db.removeChannel(channel);
        resolve();
      }
    });
});

// --- Cleanup ---------------------------------------------------------------
// Uses the service-role key, since anon deliberately has no DELETE policy.
await admin.from("photos").delete().like("original_url", `${probeUrl}%`);
await admin.from("photos").delete().like("original_url", "%/check-%");

console.log(
  failures === 0
    ? "\n\x1b[32mAll checks passed.\x1b[0m Restart the dev server and the booth wall goes live.\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m See the hints above.\n`,
);
process.exit(failures === 0 ? 0 : 1);
