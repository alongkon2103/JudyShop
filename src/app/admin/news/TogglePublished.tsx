"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/admin/Switch";
import { useToast } from "@/components/admin/toast/ToastContext";
import { setNewsPublished } from "./_actions";

export function TogglePublished({ id, isPublished }: { id: string; isPublished: boolean }) {
  const [checked, setChecked] = useState(isPublished);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const handle = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      try { await setNewsPublished(id, next); }
      catch (e) {
        setChecked(!next);
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Switch
      label={checked ? "Published" : "Hidden"}
      checked={checked}
      onChange={handle}
      disabled={pending}
    />
  );
}
