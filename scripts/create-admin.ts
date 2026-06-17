/**
 * Create or update an admin user.
 *
 *   npm run admin:create -- admin@example.com 'Sup3rSecret!' "Admin Name"
 *   npm run admin:create -- admin@example.com 'Sup3rSecret!'
 *
 * Existing users with the same email get their password (and name) updated,
 * which is the safest behaviour for an admin-recovery script.
 */
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim() || undefined;

  if (!email || !password) {
    console.error(
      "Usage: npm run admin:create -- <email> <password> [\"name\"]",
    );
    process.exit(2);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    console.error("Invalid email format.");
    process.exit(2);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(2);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.adminUser.upsert({
    where: { email },
    update: { passwordHash, ...(name ? { name } : {}), isActive: true },
    create: { email, passwordHash, name, isActive: true },
  });

  console.log(`Admin ready: ${user.email} (id=${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
