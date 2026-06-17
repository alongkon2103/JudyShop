import * as React from "react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "discord";
type Size = "sm" | "md" | "lg";

/**
 * Kawaii pill button — chunky display font, soft drop shadow,
 * gentle lift on hover, press-in on click.
 */
const base = [
  "group/btn relative inline-flex items-center justify-center gap-2 select-none",
  "font-sans font-extrabold uppercase tracking-[0.06em]",
  "rounded-full transition-all duration-fast ease-spring",
  "active:translate-y-0.5",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
  "disabled:opacity-55 disabled:pointer-events-none",
].join(" ");

const sizes: Record<Size, string> = {
  sm: "h-10 px-5 text-[13px]",
  md: "h-12 px-7 text-[15px]",
  lg: "h-14 px-9 text-[17px]",
};

const variants: Record<Variant, string> = {
  // Pink balloon — main CTA.
  primary: [
    "text-white bg-pink-500",
    "shadow-[0_3px_0_var(--pink-600),0_10px_28px_-8px_hsl(330_80%_50%/0.45)]",
    "hover:-translate-y-0.5 hover:bg-pink-400",
  ].join(" "),

  // Violet companion.
  secondary: [
    "text-white bg-violet-500",
    "shadow-[0_3px_0_var(--violet-700),0_10px_28px_-8px_hsl(265_60%_30%/0.45)]",
    "hover:-translate-y-0.5 hover:bg-violet-400",
  ].join(" "),

  // Outlined ghost.
  ghost: [
    "text-fg-dark border-2 border-line-dark bg-bg-800/40 backdrop-blur",
    "hover:border-violet-300 hover:bg-bg-800/70",
  ].join(" "),

  // Discord brand.
  discord: [
    "text-white bg-[hsl(235_86%_67%)]",
    "shadow-[0_3px_0_hsl(235_70%_45%),0_10px_28px_-8px_hsl(235_70%_45%/0.5)]",
    "hover:-translate-y-0.5 hover:bg-[hsl(235_86%_60%)]",
  ].join(" "),
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type AnchorProps = CommonProps & {
  href: string;
  target?: string;
  rel?: string;
};

export function Button(props: ButtonProps | AnchorProps) {
  const { variant = "primary", size = "md", className, children, ...rest } = props;
  const classes = cn(base, sizes[size], variants[variant], className);

  if ("href" in rest && rest.href) {
    const { href, ...anchorRest } = rest as AnchorProps;
    // External links (http://, https://, mailto:) bypass the i18n router —
    // it only wraps relative internal paths with the locale prefix.
    const isExternal = /^([a-z]+:)?\/\//i.test(href) || href.startsWith("mailto:");
    if (isExternal) {
      return (
        <a href={href} className={classes} {...anchorRest}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {children}
      </Link>
    );
  }
  return (
    <button
      className={classes}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
