import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { EMPTY_ADMIN_DATA } from "./types";
import { getAdminSupabase } from "@/lib/supabase/server";

/* ------------------------------------------------------------------
   Where the admin's edits live.

   Two backends, one interface:
     · Supabase — a single `site_config` row holding the JSON blob. This
       is what runs in production, and it survives deploys.
     · Local JSON file — used when Supabase is not configured, so the
       console is fully usable the moment you clone the repo.

   Serverless filesystems are read-only and ephemeral, so the file
   backend is explicitly a development convenience. The console says so
   when it is the one in use.
   ------------------------------------------------------------------ */

const FILE = path.join(process.cwd(), ".data", "admin.json");
const CONFIG_KEY = "storefront";

let cache = null;
const CACHE_MS = 1000;

export function storageBackend() {
  return getAdminSupabase() ? "supabase" : "file";
}

async function readFile() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return { ...EMPTY_ADMIN_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_ADMIN_DATA };
  }
}

/** Thrown when the file backend cannot write, which on a serverless host is
 *  every time. Carries an explanation rather than a raw errno. */
export class StorageUnavailableError extends Error {}

async function writeFile(data) {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    const code = e?.code;
    // Serverless filesystems are read-only apart from /tmp, and /tmp is wiped
    // between invocations — so writing there would look like it worked and
    // then silently lose the data, which is worse than failing.
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new StorageUnavailableError(
        "This deployment has no database, and its filesystem is read-only. " +
          "Connect Supabase (SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL) " +
          "to save changes — see DEPLOY.md step 1.",
      );
    }
    throw e;
  }
}

export async function readAdminData() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const db = getAdminSupabase();
  let data;

  if (db) {
    const { data: row, error } = await db
      .from("site_config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();
    if (error) console.error("[admin] read failed", error);
    data = { ...EMPTY_ADMIN_DATA, ...(row?.value ?? {}) };
  } else {
    data = await readFile();
  }

  cache = { data, at: Date.now() };
  return data;
}

export async function writeAdminData(next) {
  next.updatedAt = new Date().toISOString();
  const db = getAdminSupabase();

  if (db) {
    const { error } = await db
      .from("site_config")
      .upsert({ key: CONFIG_KEY, value: next }, { onConflict: "key" });
    if (error) throw new Error(`Could not save: ${error.message}`);
  } else {
    await writeFile(next);
  }
  cache = { data: next, at: Date.now() };
}

/** Read, mutate, write. Keeps every caller from repeating the dance. */
export async function updateAdminData(fn) {
  const current = await readAdminData();
  const draft = JSON.parse(JSON.stringify(current));
  const result = await fn(draft);
  await writeAdminData(draft);
  return { data: draft, result };
}
