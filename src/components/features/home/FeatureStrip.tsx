import { Bolt, ShieldCheck, MessageCircleHeart } from "lucide-react";
import { Container } from "@/components/ui/Container";

const FEATURES = [
  {
    icon: Bolt,
    title: "Instant Delivery",
    desc: "ส่งสิทธิ์เข้าเกมทันทีหลังชำระเงินสำเร็จ",
  },
  {
    icon: ShieldCheck,
    title: "Trusted Store",
    desc: "ผู้ขายยืนยันตัวตน + ระบบป้องกันการโกง",
  },
  {
    icon: MessageCircleHeart,
    title: "Discord Support 24/7",
    desc: "ทีมงานพร้อมช่วยเหลือทุกเวลาผ่าน Discord",
  },
];

export function FeatureStrip() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <ul className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <li
              key={title}
              className="glass-panel anim-fade-up flex items-start gap-4 rounded-2xl p-5"
              style={{ animationDelay: `${0.5 + i * 0.1}s` }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-purple-500/20 text-brand-pink-300 ring-1 ring-brand-purple-300/20">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm text-white/70">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
