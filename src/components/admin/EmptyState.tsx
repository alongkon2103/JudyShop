import { cn } from "@/lib/cn";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/** Friendly empty-state placeholder shown in lists / nested CRUD tabs. */
export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "panel grid place-items-center rounded-xl px-s4 py-s6 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-s2 grid h-12 w-12 place-items-center rounded-full bg-pink-500/12 text-pink-400">
          {icon}
        </span>
      )}
      <p className="font-display text-[20px] text-fg-light">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-[13px] text-fg-light-soft">{description}</p>
      )}
      {action && <div className="mt-s3">{action}</div>}
    </div>
  );
}
