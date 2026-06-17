import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton — survives Next.js HMR in dev so we don't
 * exhaust the Supabase connection pool on every save.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
