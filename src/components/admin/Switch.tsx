"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type CommonProps = {
  name?: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

type Uncontrolled = CommonProps & {
  defaultChecked?: boolean;
  checked?: undefined;
  onChange?: undefined;
};

type Controlled = CommonProps & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  defaultChecked?: undefined;
};

type Props = Uncontrolled | Controlled;

/**
 * Accessible toggle switch. Use either:
 *   <Switch name="isActive" defaultChecked label="Active" />
 *   <Switch checked={x} onChange={setX} label="Auto-convert" />
 *
 * Renders a real <input type="checkbox"> so server actions reading
 * formData see "on" / undefined exactly like a normal checkbox.
 */
export function Switch(props: Props) {
  const { name, label, hint, disabled, className } = props;
  const controlled = "checked" in props && props.checked !== undefined;

  return (
    <label
      className={cn(
        "group/sw inline-flex select-none items-start gap-2.5",
        disabled ? "opacity-55" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative inline-block h-5 w-9 shrink-0">
        <input
          type="checkbox"
          name={name}
          disabled={disabled}
          className="peer sr-only"
          {...(controlled
            ? { checked: (props as Controlled).checked, onChange: (e) => (props as Controlled).onChange(e.target.checked) }
            : { defaultChecked: (props as Uncontrolled).defaultChecked })}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full border bg-paper-3 transition-colors duration-fast",
            "peer-checked:bg-pink-500 peer-checked:border-pink-500",
            "border-line-light",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-pink-400/40",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm",
            "transition-transform duration-fast ease-spring",
            "peer-checked:translate-x-4",
          )}
        />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-medium text-fg-light">{label}</span>
        {hint && <span className="block text-[11px] text-fg-light-mute">{hint}</span>}
      </span>
    </label>
  );
}
