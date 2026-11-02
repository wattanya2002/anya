import { MessageCircle, Phone } from "lucide-react";

/** One-tap supplier shortcuts: phone dialer and LINE chat. Rendered only for values that exist. */
export function ContactButtons({ name, phone, lineUrl, size = "sm" }: { name: string; phone: string | null; lineUrl: string | null; size?: "sm" | "md" }) {
  if (!phone && !lineUrl) return null;
  return (
    <span className={`contact contact-${size}`}>
      {phone && (
        <a className="contact-btn tel" href={`tel:${phone}`} aria-label={`โทรหา ${name} ${phone}`} title={phone}>
          <Phone aria-hidden="true" /><span>โทร</span>
        </a>
      )}
      {lineUrl && (
        <a className="contact-btn line" href={lineUrl} target="_blank" rel="noopener noreferrer" aria-label={`เปิดแชท LINE ของ ${name}`}>
          <MessageCircle aria-hidden="true" /><span>LINE</span>
        </a>
      )}
    </span>
  );
}
