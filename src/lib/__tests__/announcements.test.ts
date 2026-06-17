/**
 * Tests for `getActiveAnnouncement` — the fetcher that the public home
 * page calls to decide whether to show an announcement popup.
 *
 * The function MUST:
 *   1. Pass the right `where` filter to Prisma so we don't accidentally
 *      surface scheduled / disabled / expired announcements.
 *   2. Order by `priority desc, createdAt desc` so the latest pinned
 *      announcement wins.
 *   3. Honour locale when picking message text (TH on /th, EN on /en).
 *   4. Coerce empty / whitespace fields to `null` so the popup logic
 *      can short-circuit on truly empty entries.
 *   5. Trim the imageUrl too — leading/trailing spaces shouldn't make
 *      a poster URL invisible.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: { announcement: { findFirst: vi.fn() } },
}));

import { getActiveAnnouncement } from "../announcements";
import { db } from "../db";

function makeRow(overrides: Partial<{
  id: string;
  messageEn: string | null;
  messageTh: string | null;
  imageUrl: string | null;
  updatedAt: Date;
}> = {}) {
  return {
    id:        overrides.id ?? "ann-1",
    messageEn: overrides.messageEn ?? "Welcome!",
    messageTh: overrides.messageTh ?? "ยินดีต้อนรับ",
    imageUrl:  overrides.imageUrl ?? null,
    startDate: new Date("2026-01-01T00:00:00Z"),
    endDate:   null,
    isActive:  true,
    priority:  0,
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-06-01T00:00:00Z"),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getActiveAnnouncement — Prisma query shape", () => {
  it("filters by isActive=true AND startDate<=now AND (endDate is null OR endDate>now)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00Z"));
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(null);

    await getActiveAnnouncement();

    const args = vi.mocked(db.announcement.findFirst).mock.calls[0]![0]!;
    const expectedNow = new Date("2026-06-08T12:00:00Z");
    expect(args.where).toEqual({
      isActive: true,
      startDate: { lte: expectedNow },
      OR: [{ endDate: null }, { endDate: { gt: expectedNow } }],
    });

    vi.useRealTimers();
  });

  it("orders by priority desc then createdAt desc (latest pinned wins)", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(null);
    await getActiveAnnouncement();
    const args = vi.mocked(db.announcement.findFirst).mock.calls[0]![0]!;
    expect(args.orderBy).toEqual([
      { priority: "desc" },
      { createdAt: "desc" },
    ]);
  });
});

describe("getActiveAnnouncement — Locale handling", () => {
  it("picks the Thai message on locale='th'", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ messageEn: "Hello", messageTh: "สวัสดี" }) as any,
    );
    const r = await getActiveAnnouncement("th");
    expect(r?.message).toBe("สวัสดี");
  });

  it("picks the English message on locale='en'", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ messageEn: "Hello", messageTh: "สวัสดี" }) as any,
    );
    const r = await getActiveAnnouncement("en");
    expect(r?.message).toBe("Hello");
  });

  it("defaults to English when no locale is passed", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ messageEn: "Hello", messageTh: "สวัสดี" }) as any,
    );
    const r = await getActiveAnnouncement();
    expect(r?.message).toBe("Hello");
  });

  it("falls back to the OTHER language if the preferred side is empty", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ messageEn: "Hello only", messageTh: "" }) as any,
    );
    const r = await getActiveAnnouncement("th");
    expect(r?.message).toBe("Hello only");
  });
});

describe("getActiveAnnouncement — empty / image-only handling", () => {
  it("returns null when no row is found", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(null);
    const r = await getActiveAnnouncement();
    expect(r).toBeNull();
  });

  it("returns null when both message and imageUrl are empty", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ messageEn: "", messageTh: "", imageUrl: null }) as any,
    );
    expect(await getActiveAnnouncement()).toBeNull();
  });

  it("returns null when message is whitespace-only and there is no image", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ messageEn: "   ", messageTh: "\t\n  ", imageUrl: null }) as any,
    );
    expect(await getActiveAnnouncement()).toBeNull();
  });

  it("treats image-only rows as valid (poster-only popup)", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({
        messageEn: "", messageTh: "",
        imageUrl: "https://cdn.example.com/poster.png",
      }) as any,
    );
    const r = await getActiveAnnouncement();
    expect(r).not.toBeNull();
    expect(r!.message).toBeNull();
    expect(r!.imageUrl).toBe("https://cdn.example.com/poster.png");
  });

  it("trims whitespace from the imageUrl before returning", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ imageUrl: "   https://cdn/a.jpg   " }) as any,
    );
    const r = await getActiveAnnouncement();
    expect(r?.imageUrl).toBe("https://cdn/a.jpg");
  });

  it("treats whitespace-only imageUrl as null", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({ imageUrl: "   " }) as any,
    );
    const r = await getActiveAnnouncement();
    // Whitespace-only image → null, but the message is non-empty so the
    // popup still shows (text-only).
    expect(r?.imageUrl).toBeNull();
    expect(r?.message).not.toBeNull();
  });
});

describe("getActiveAnnouncement — response shape", () => {
  it("exposes the expected public fields and nothing else", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(
      makeRow({
        id: "ann-X",
        messageTh: "ยินดี",
        imageUrl: "https://x/y.png",
        updatedAt: new Date("2026-06-05T10:30:00Z"),
      }) as any,
    );
    const r = await getActiveAnnouncement("th");
    expect(Object.keys(r!).sort()).toEqual(["id", "imageUrl", "message", "updatedAt"]);
    expect(r!.id).toBe("ann-X");
    expect(r!.message).toBe("ยินดี");
    expect(r!.imageUrl).toBe("https://x/y.png");
    expect(r!.updatedAt).toBe("2026-06-05T10:30:00.000Z");
  });

  it("serialises `updatedAt` as an ISO string (not a Date instance)", async () => {
    vi.mocked(db.announcement.findFirst).mockResolvedValueOnce(makeRow() as any);
    const r = await getActiveAnnouncement();
    expect(typeof r!.updatedAt).toBe("string");
    expect(Number.isFinite(Date.parse(r!.updatedAt))).toBe(true);
  });
});
