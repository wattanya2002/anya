"use client";
import { useActionState } from "react";
import { uploadImport, confirmImport } from "@/app/(app)/inventory/actions";
import type { FormState } from "@/app/actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadImport, {});
  return (
    <form action={action} className="form-grid">
      <div className="field span-2">
        <label htmlFor="imp-file">ไฟล์ Excel (.xlsx) หรือ CSV (UTF-8) ไม่เกิน 2 MB</label>
        <input id="imp-file" name="file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required />
      </div>
      {state.error && <p className="form-msg err span-2" role="alert">{state.error}</p>}
      <button className="btn span-2" type="submit" disabled={pending}>{pending ? "กำลังตรวจไฟล์…" : "อัปโหลดและตรวจข้อมูล"}</button>
    </form>
  );
}

export function ConfirmForm({ jobId, validCount }: { jobId: string; validCount: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(confirmImport, {});
  if (state.ok) return <p className="form-msg ok" role="status">{state.ok}</p>;
  return (
    <form action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      {state.error && <p className="form-msg err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending || validCount === 0}>
        {pending ? "กำลังนำเข้า…" : `ยืนยันนำเข้า ${validCount} แถวที่ถูกต้อง`}
      </button>
    </form>
  );
}
