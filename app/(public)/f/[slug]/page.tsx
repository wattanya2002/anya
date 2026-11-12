import type { Metadata } from "next";
import { CircleSlash, SearchX } from "lucide-react";
import { publishedBySlug } from "@/lib/forms-server";
import { currentTerms } from "@/lib/kol";
import { PublicForm } from "@/components/kol/public-form";
import { startStamp } from "@/app/(public)/actions";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const form = await publishedBySlug((await params).slug);
  return { title: form ? `${form.title} · Wonder Courts` : "Wonder Courts", robots: { index: false, follow: false } };
}

export default async function PublicFormPage({ params }: Props) {
  const { slug } = await params;
  const form = await publishedBySlug(slug);
  if (!form || form.purpose === "kol_registration") {
    return <Message icon={<SearchX aria-hidden="true" />} title="ไม่พบแบบฟอร์มนี้" body="ลิงก์อาจไม่ถูกต้อง กรุณาตรวจสอบลิงก์อีกครั้ง หรือติดต่อ LINE @wondercourts" />;
  }
  if (form.status !== "published") {
    return <Message icon={<CircleSlash aria-hidden="true" />} title="ปิดรับข้อมูลแล้ว" body={`แบบฟอร์ม “${form.title}” ปิดรับข้อมูลแล้ว ขอบคุณที่สนใจ ติดตามข่าวสารได้ที่ LINE @wondercourts`} />;
  }
  const terms = form.purpose === "kol_application" && form.campaignId ? await currentTerms(form.campaignId) : null;
  return (
    <PublicForm mode="public" formId={form.formId} slug={form.slug} versionId={form.versionId} title={form.title} schema={form.schema}
      terms={terms ? { id: terms.id, versionNo: terms.versionNo, title: terms.title, items: terms.items } : null} stamp={await startStamp()}
      heroUrl={form.schema.settings.heroFileId ? `/api/public/hero/${form.schema.settings.heroFileId}` : null} />
  );
}

function Message({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="pf-root">
      <div className="pf-wrap">
        <span className="pf-brand"><span className="pf-ball" aria-hidden="true" />Wonder Courts</span>
        <div className="pf-closed">{icon}<h1>{title}</h1><p>{body}</p></div>
      </div>
    </div>
  );
}
