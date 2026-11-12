import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Shareable CEO card link: opens the card when signed in, otherwise signs in first and comes back to it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = /^[0-9a-f-]{36}$/i.test(id) ? `/kol/ceo/r/${id.toLowerCase()}` : "/kol/ceo";
  const dest = (await getCurrentUser()) ? card : `/sign-in?next=${encodeURIComponent(card)}`;
  return NextResponse.redirect(new URL(dest, req.url));
}
