"use client";
import { useEffect } from "react";

/** Applies calendar filters as soon as a select or toggle changes (search still applies on Enter). */
export function FilterAutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === "checkbox")) form.requestSubmit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [formId]);
  return null;
}
