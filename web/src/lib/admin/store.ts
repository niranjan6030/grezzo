import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { EMPTY_ADMIN_DATA, type AdminData } from "./types";
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

let cache: { data: AdminData; at: number } | null = null;
const CACHE_MS = 1000;

export function storageBackend(): "supabase" | "file" {
  return getAdminSupabase() ? "supabase" : "file";
}

async function readFile(): Promise<AdminData> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return { ...EMPTY_ADMIN_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_ADMIN_DATA };
  }
}

async function writeFile(data: AdminData): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function readAdminData(): Promise<AdminData> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const db = getAdminSupabase();
  let data: AdminData;

  if (db) {
    const { data: row, error } = await db
      .from("site_config").select("value").eq("key", CONFIG_KEY).maybeSingle();
    if (error) console.error("[admin] read failed", error);
    data = { ...EMPTY_ADMIN_DATA, ...((row?.value as AdminData) ?? {}) };
  } else {
    data = await readFile();
  }

  cache = { data, at: Date.now() };
  return data;
}

export async function writeAdminData(next: AdminData): Promise<void> {
  next.updatedAt = new Date().toISOString();
  const db = getAdminSupabase();

  if (db) {
    const { error } = await db.from("site_config")
      .upsert({ key: CONFIG_KEY, value: next }, { onConflict: "key" });
    if (error) throw new Error(`Could not save: ${error.message}`);
  } else {
    await writeFile(next);
  }
  cache = { data: next, at: Date.now() };
}

/** Read, mutate, write. Keeps every caller from repeating the dance. */
export async function updateAdminData<T>(
  fn: (draft: AdminData) => T | Promise<T>,
): Promise<{ data: AdminData; result: T }> {
  const current = await readAdminData();
  const draft: AdminData = JSON.parse(JSON.stringify(current));
  const result = await fn(draft);
  await writeAdminData(draft);
  return { data: draft, result };
}
