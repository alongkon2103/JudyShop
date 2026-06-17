import Image from "next/image";
import { Link } from "@/i18n/routing";

export function Logo() {
  return (
    <Link
      href="/"
      aria-label="Judy Shop"
      className="group relative block h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-pink-400/40 shadow-[0_4px_18px_-4px_hsl(330_70%_45%/0.45)] transition-transform duration-fast ease-spring hover:scale-105 sm:h-[72px] sm:w-[72px] lg:h-[88px] lg:w-[88px]"
    >
      <Image
        src="/images/JudyLogo.png"
        alt="Judy Shop"
        fill
        sizes="(max-width: 640px) 56px, (max-width: 1024px) 72px, 88px"
        priority
        className="object-cover"
      />
    </Link>
  );
}
