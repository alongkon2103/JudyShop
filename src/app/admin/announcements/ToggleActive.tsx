"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/admin/Switch";
import { useToast } from "@/components/admin/toast/ToastContext";
import { setAnnouncementActive } from "./_actions";

export function ToggleActive({ id, isActive }: { id: string; isActive: boolean }) {
  const [checked, setChecked] = useState(isActive);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const handle = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      try {
        await setAnnouncementActive(id, next);
      } catch (e) {
        setChecked(!next);
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Switch
      label={checked ? "Active" : "Off"}
      checked={checked}
      onChange={handle}
      disabled={pending}
    />
  );
}
