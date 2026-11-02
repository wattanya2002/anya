"use client";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createTodayTask, setTaskDone, type FormState } from "@/app/actions";

type Task = { id: string; title: string; dueTime: string | null; done: boolean };

export function TaskList({ tasks, canManage }: { tasks: Task[]; canManage: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state: Task[], u: { id: string; done: boolean }) =>
    state.map((t) => (t.id === u.id ? { ...t, done: u.done } : t)),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  function toggle(t: Task, done: boolean) {
    setPendingId(t.id);
    start(async () => {
      setOptimistic({ id: t.id, done });
      const r = await setTaskDone(t.id, done);
      setErrors((e) => ({ ...e, [t.id]: r.error ?? "" }));
      setPendingId(null);
    });
  }

  if (optimistic.length === 0) {
    return (
      <div className="empty-state" style={{ paddingBottom: 4 }}>
        <strong>ยังไม่มีงานสำหรับวันนี้</strong>
        {canManage ? <span>กดปุ่ม + ด้านบนเพื่อเพิ่มงาน</span> : null}
      </div>
    );
  }
  return (
    <ul className="task-list">
      {optimistic.map((t) => (
        <li key={t.id} className={`task${t.done ? " done" : ""}`}>
          <label>
            <input type="checkbox" checked={t.done} disabled={!canManage || pendingId === t.id} onChange={(e) => toggle(t, e.target.checked)} />
            <span className="task-title">{t.title}</span>
          </label>
          <span className="task-time">{t.dueTime ? `${t.dueTime} น.` : "ตลอดทั้งวัน"}</span>
          {errors[t.id] ? <span className="task-error" role="alert">{errors[t.id]}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function AddTaskButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(createTodayTask, {});
  return (
    <details className="menu">
      <summary className="more" aria-label="เพิ่มงานวันนี้"><Plus aria-hidden="true" /></summary>
      <div className="menu-panel">
        <h3>เพิ่มงานวันนี้</h3>
        <form className="task-form" action={action} key={state.nonce ?? "new"} style={{ padding: "0 10px 10px" }}>
          <div className="field">
            <label htmlFor="task-title">ชื่องาน</label>
            <input id="task-title" name="title" required maxLength={200} defaultValue={state.ok ? "" : state.fields?.title} />
          </div>
          <div className="field">
            <label htmlFor="task-time">เวลา (เว้นว่าง = ตลอดทั้งวัน)</label>
            <input id="task-time" name="dueTime" type="time" defaultValue={state.ok ? "" : state.fields?.dueTime} />
          </div>
          {state.error ? <p className="form-msg err" role="alert">{state.error}</p> : null}
          {state.ok ? <p className="form-msg ok" role="status">{state.ok}</p> : null}
          <button className="btn" type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
        </form>
      </div>
    </details>
  );
}
