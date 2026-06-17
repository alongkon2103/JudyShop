"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/** Section heading inside a form card — readable, no shouty tracking. */
export function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="border-b border-line-light pb-2">
        <h3 className="text-[15px] font-semibold text-fg-light">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12px] text-fg-light-soft">{subtitle}</p>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Generic labeled field wrapper. */
export function Field({
  label,
  hint,
  error,
  full = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-[12px] font-semibold text-fg-light">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-semibold text-pink-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-fg-light-mute">{hint}</span>
      ) : null}
    </label>
  );
}

/** Stack of two inputs labelled (EN) / (TH). */
export function I18nField({
  label,
  nameEn,
  nameTh,
  defaultValueEn,
  defaultValueTh,
  hint,
  errorEn,
  errorTh,
  required,
  textarea,
  maxLength,
}: {
  label: string;
  nameEn: string;
  nameTh: string;
  defaultValueEn?: string;
  defaultValueTh?: string;
  hint?: string;
  errorEn?: string;
  errorTh?: string;
  required?: boolean;
  textarea?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-[12px] font-semibold text-fg-light">
        {label} {required && <span className="text-pink-500">*</span>}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LangInput
          lang="EN"
          name={nameEn}
          defaultValue={defaultValueEn}
          required={required}
          textarea={textarea}
          maxLength={maxLength}
          error={errorEn}
        />
        <LangInput
          lang="TH"
          name={nameTh}
          defaultValue={defaultValueTh}
          required={required}
          textarea={textarea}
          maxLength={maxLength}
          error={errorTh}
        />
      </div>
      {hint && <p className="text-[11px] text-fg-light-mute">{hint}</p>}
    </div>
  );
}

function LangInput({
  lang,
  name,
  defaultValue,
  required,
  textarea,
  maxLength,
  error,
}: {
  lang: "EN" | "TH";
  name: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
  maxLength?: number;
  error?: string;
}) {
  return (
    <div>
      <span className="mb-1 inline-flex items-center rounded-sm bg-pink-500/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-pink-500">
        {lang}
      </span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          required={required}
          maxLength={maxLength}
          rows={4}
          className={cn(inputClass, "resize-y", error && errorRing)}
        />
      ) : (
        <input
          type="text"
          name={name}
          defaultValue={defaultValue}
          required={required}
          maxLength={maxLength}
          className={cn(inputClass, error && errorRing)}
        />
      )}
      {error && <span className="mt-1 block text-[11px] font-semibold text-pink-500">{error}</span>}
    </div>
  );
}

/** Keep Checkbox for cases where a switch isn't appropriate (e.g. multi-pick). */
export function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] font-medium text-fg-light">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-pink-500"
      />
      {label}
    </label>
  );
}

export const inputClass = cn(
  "w-full rounded-md border border-line-light bg-paper-2 px-3 py-2.5 text-[14px] text-fg-light",
  "transition-colors duration-fast",
  "focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-400/15",
);

export const errorRing = "border-pink-500/60 focus:border-pink-500 focus:ring-pink-400/20";
