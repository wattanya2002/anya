import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getForm } from "@/lib/forms-server";
import type { FieldType } from "@/lib/forms-core";
import { FormEditor } from "@/components/kol/form-editor";

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "forms.manage")) notFound();
  const { id } = await params;
  const form = await getForm(user.orgId, id);
  if (!form) notFound();
  const types = form.currentVersionId
    ? Object.fromEntries((await db().query(`select field_key, type from form_fields where version_id = $1`, [form.currentVersionId])).rows.map((r) => [r.field_key, r.type as FieldType]))
    : {};
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (
    <>
      <Link href="/kol/forms" className="k-back"><ArrowLeft aria-hidden="true" />Form Dashboard</Link>
      <h1 className="sr-only">แก้ไขฟอร์ม {form.title}</h1>
      <FormEditor formId={form.id} title={form.title} purpose={form.purpose} status={form.status} versionNo={form.versionNo} draft={form.draft} rev={form.draftRev}
        draftDirty={form.draftDirty} publishedTypes={types} responses={form.responses} publicUrl={`${proto}://${host}/f/${form.slug}`} />
    </>
  );
}
