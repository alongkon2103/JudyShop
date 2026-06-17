/**
 * Audit log — write side.
 *
 * `logAdmin()` is called from every admin server action that mutates
 * something. We never throw from this helper — a failure to log must
 * not break the user-facing action. (We do `console.error` so the
 * failure shows up in logs.)
 *
 * Action names are dot-namespaced kebab-case strings, e.g.
 *   "product.create"  · "product.update"  · "product.delete"
 *   "plan.create"     · "plan.update"     · "plan.delete"
 *   "whitelist.create" · "whitelist.update" · "whitelist.delete"
 *   "order.refund"
 *   "announcement.create" · ...
 *   "settings.update"
 *
 * Keep the payload SMALL — for updates, prefer a `{ from, to }` diff of
 * the fields that changed, not the entire row. Big payloads slow down
 * the audit page and bloat backups.
 */
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { db } from "./db";
import { getAdminSession } from "./admin-session";
import { clientIp } from "./rate-limit";

type LogArgs = {
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Prisma.InputJsonValue;
};

export async function logAdmin(args: LogArgs): Promise<void> {
  try {
    const session = await getAdminSession();
    const ip = (() => {
      try { return clientIp(headers()); } catch { return null; }
    })();

    await db.auditLog.create({
      data: {
        actorId:    session?.sub ?? null,
        actorEmail: session?.email ?? null,
        action:     args.action,
        targetType: args.targetType ?? null,
        targetId:   args.targetId ?? null,
        payload:    args.payload ?? Prisma_skipNull(),
        ip,
      },
    });
  } catch (err) {
    console.error("[audit] failed to log", args.action, err);
  }
}

// Prisma rejects `undefined` JSON fields but allows omitting the key —
// since we always pass `payload`, ensure undefined becomes the absent key.
function Prisma_skipNull(): Prisma.InputJsonValue | undefined {
  return undefined as unknown as Prisma.InputJsonValue;
}

/**
 * Compute a tiny `{ from, to }` payload for an update — picks ONLY keys
 * that actually changed. Use it when both old and new values are at hand
 * (e.g. after `findUnique` + mutation) so the audit log doesn't bloat.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: (keyof T)[],
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (!shallowEqual(a, b)) {
      out[String(k)] = { from: a as unknown, to: b as unknown };
    }
  }
  return out;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}
