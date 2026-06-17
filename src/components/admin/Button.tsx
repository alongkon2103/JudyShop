import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-extrabold uppercase tracking-[0.1em] " +
  "transition-all duration-fast ease-spring active:translate-y-px " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 " +
  "disabled:opacity-55 disabled:pointer-events-none";

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[11px]",
  md: "h-10 px-5 text-[12px]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-pink-500 text-white shadow-[0_3px_0_var(--pink-600)] hover:-translate-y-0.5",
  outline:
    "border border-line-light text-fg-light hover:bg-paper-2",
  danger:
    "border border-pink-500/40 text-pink-400 hover:bg-pink-500/10",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AnchorProps = CommonProps & { href: string };

/** Compact admin button — separate from the kawaii public Button. */
export function AdminButton(props: ButtonProps | AnchorProps) {
  const { variant = "primary", size = "md", className, children, ...rest } = props;
  const classes = cn(base, sizes[size], variants[variant], className);
  if ("href" in rest && rest.href) {
    const { href, ...anchorRest } = rest as AnchorProps;
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
