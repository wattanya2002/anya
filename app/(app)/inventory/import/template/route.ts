import { getCurrentUser, can } from "@/lib/auth";
import { templateWorkbook } from "@/lib/inventory-import";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "inventory.view")) return new Response("Unauthorized", { status: 401 });
  const buf = await templateWorkbook();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="wonder-courts-products-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
