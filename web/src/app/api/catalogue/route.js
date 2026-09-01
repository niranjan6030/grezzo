import { NextResponse } from "next/server";
import { readAdminData } from "@/lib/admin/store";
import { mergeCatalogue } from "@/lib/catalogue";

/** The catalogue as shoppers should see it: built-in products with the
 *  admin's edits and any live offer already applied. */
export async function GET() {
  const data = await readAdminData();
  return NextResponse.json(
    { products: mergeCatalogue(data), updatedAt: data.updatedAt },
    { headers: { "cache-control": "no-store" } },
  );
}
