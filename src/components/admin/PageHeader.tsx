import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Crumb = { label: string; href?: string };

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
};

/** Consistent header used at the top of every admin page. */
export function PageHeader({
  kicker,
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: Props) {
  return (
    <header className={cn("mb-s4 flex flex-col gap-s2 sm:flex-row sm:items-end sm:justify-between sm:gap-s3", className)}>
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1.5 flex flex-wrap items-center gap-1 text-[12px] font-medium text-fg-dark-mute">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-fg-dark">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < breadcrumbs.length - 1 && (
                  <ChevronRight size={12} strokeWidth={2.5} className="opacity-60" />
                )}
              </span>
            ))}
          </nav>
        )}

        {kicker && (
          <p className="text-[12px] font-semibold text-fg-dark-mute">{kicker}</p>
        )}
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-fg-dark sm:text-[26px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-fg-dark-soft sm:text-[14px]">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-s2">{actions}</div>}
    </header>
  );
}
