import Link from "next/link";
import { SITE } from "@/constants/site";
import { cn } from "@/lib/cn";

function DiscordIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.27 5.33A18.4 18.4 0 0 0 15.05 4l-.21.42a17 17 0 0 0-5.68 0L8.95 4a18.4 18.4 0 0 0-4.22 1.33C2.1 9.18 1.4 13 1.74 16.74A18.6 18.6 0 0 0 7.4 19.6l1-1.42a12 12 0 0 1-1.92-.94l.47-.34a13 13 0 0 0 11.1 0l.47.34c-.6.36-1.24.67-1.92.94l1 1.42a18.6 18.6 0 0 0 5.66-2.86c.42-4.3-.65-8.08-3.99-11.41ZM8.92 14.6c-1.12 0-2.04-1.04-2.04-2.32 0-1.28.9-2.32 2.04-2.32 1.13 0 2.05 1.04 2.04 2.32 0 1.28-.91 2.32-2.04 2.32Zm6.16 0c-1.12 0-2.04-1.04-2.04-2.32 0-1.28.9-2.32 2.04-2.32 1.13 0 2.05 1.04 2.04 2.32 0 1.28-.91 2.32-2.04 2.32Z" />
    </svg>
  );
}
function TikTokIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.5 8.5a6.5 6.5 0 0 1-4-1.36V15a5.5 5.5 0 1 1-5.5-5.5c.32 0 .63.03.94.08v2.74a2.8 2.8 0 1 0 1.96 2.68V3h2.6a4 4 0 0 0 4 4v1.5Z" />
    </svg>
  );
}

const ITEM =
  "grid h-10 w-10 place-items-center rounded-full text-white shadow-[0_3px_0_hsl(265_60%_15%/0.55)] transition-transform duration-fast ease-spring hover:scale-110 hover:rotate-6";

export function SocialIcons({ className = "" }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Link
        href={SITE.discordUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Discord"
        className={cn(ITEM, "bg-[hsl(235_86%_67%)]")}
      >
        <DiscordIcon className="h-5 w-5" />
      </Link>
      <Link
        href={SITE.tiktokUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="TikTok"
        className={cn(ITEM, "bg-black")}
      >
        <TikTokIcon className="h-5 w-5" />
      </Link>
    </div>
  );
}
