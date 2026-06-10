import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAdminClient } from "../lib/supabase";

const ADMIN_EMAIL = "admin@haideelogistics.com";
const ADMIN_PASSWORD = "haidee2026";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const supabase = createAdminClient();

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === ADMIN_EMAIL);

  let userId: string;

  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    console.log("Updated existing auth user:", ADMIN_EMAIL);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Admin" },
    });

    if (error) throw error;
    userId = data.user.id;
    console.log("Created auth user:", ADMIN_EMAIL);
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "admin", name: "Admin", active: true },
    create: {
      id: userId,
      email: ADMIN_EMAIL,
      name: "Admin",
      role: "admin",
    },
  });

  console.log("Admin user ready in database.");
  console.log("  Email:", ADMIN_EMAIL);
  console.log("  Password:", ADMIN_PASSWORD);
  console.log("  Role: admin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
