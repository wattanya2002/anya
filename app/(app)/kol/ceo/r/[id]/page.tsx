import { ceoInbox } from "@/lib/kol";
import { CeoCarousel, type Slide } from "@/components/kol/ceo-carousel";
import { loadCeo, decidedOf, type CeoParams } from "./load";

/** CEO master card (Master RCM screen 05) for one KOL, swipeable through the rest of the same tab. */
export default async function CeoMasterCard(p: CeoParams) {
  const { user, ctx, canDecide } = await loadCeo(p);
  const list = await ceoInbox(user.orgId, ctx.tab);
  const cards = list.some((c) => c.requestId === ctx.card.requestId) ? list : [ctx.card];
  const slides: Slide[] = cards.map((c) => ({
    id: c.requestId, name: c.applicant.creatorName, refNo: c.applicant.refNo, photo: c.applicant.photoFileId, social: c.applicant.social,
    campaign: c.campaignName, pending: c.requestStatus === "pending", decided: decidedOf(c),
  }));
  const index = Math.max(0, cards.findIndex((c) => c.requestId === ctx.card.requestId));
  return <CeoCarousel slides={slides} index={index} tab={ctx.tab} canDecide={canDecide}
    sub={canDecide ? "พิจารณา KOL ที่สมัครเข้าร่วมแคมเปญ" : "ดูสถานะการพิจารณา (ตัดสินใจได้เฉพาะ CEO)"} />;
}
