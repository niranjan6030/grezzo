import { NextResponse } from "next/server";
import { adminConfigured, checkPassword, clearSession, isSignedIn, issueSession } from "@/lib/admin/auth";

export async function GET() {
  return NextResponse.json({
    configured: adminConfigured(),
    signedIn: await isSignedIn(),
  });
}

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set. See ‘Run it now’ in the README." },
      { status: 503 },
    );
  }
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !checkPassword(password)) {
    // Deliberately vague, and deliberately slow enough to blunt guessing.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  await issueSession();
  return NextResponse.json({ signedIn: true });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ signedIn: false });
}
