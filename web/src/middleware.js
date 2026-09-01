import { NextResponse } from "next/server";

/*
 * Middleware runs on the Edge runtime, where firebase-admin cannot run — so
 * this is a cheap presence check, not a verification. It keeps signed-out
 * visitors from loading a page that would only tell them to sign in.
 *
 * The real check happens in the route handlers, with `requireUser()`. Anyone
 * forging this cookie gets a page shell and a 401 from every API call.
 */

const PROTECTED = ["/account/orders", "/checkout"];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname.startsWith(p))) return NextResponse.next();

  /* With no Firebase project wired up there is nothing to sign in to, so
     bouncing to /account would just land on a dead end. Let the request
     through and let the page explain what is missing. */
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return NextResponse.next();

  if (!req.cookies.has("grezzo_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/checkout/:path*"],
};
