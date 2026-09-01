import "server-only";
import { NextResponse } from "next/server";
import { StorageUnavailableError } from "./store";

/**
 * Wraps a route handler so a read-only filesystem reports itself properly.
 *
 * Without this, the first deploy to Vercel without Supabase answers every
 * save with a raw `EROFS: read-only file system` and a 500 — which tells the
 * person nothing about what went wrong or what to do about it.
 */
export function guarded(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof StorageUnavailableError) {
        return NextResponse.json({ error: e.message }, { status: 503 });
      }
      throw e;
    }
  };
}
