/**
 * Provision / cleanup temporary Thai cost browser-test users.
 * Run provision: npx tsx --env-file=.env.local scripts/_thai-cost-test-users.ts provision
 * Run cleanup:  npx tsx --env-file=.env.local scripts/_thai-cost-test-users.ts cleanup
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAdminClient } from "../lib/supabase";

export const TEST_CLERK_EMAIL = "test-clerk@haideelogistics.com";
export const TEST_THAI_ACCOUNTING_EMAIL =
  "test-thai-accounting@haideelogistics.com";
export const TEST_PASSWORD = "ThaiCostTest2026!x7";

const TEST_USERS = [
  {
    email: TEST_CLERK_EMAIL,
    role: "clerk" as const,
    name: "[TEST] Clerk (auto-delete)",
    language: "th" as const,
  },
  {
    email: TEST_THAI_ACCOUNTING_EMAIL,
    role: "thai_accounting" as const,
    name: "[TEST] Thai Accounting (auto-delete)",
    language: "th" as const,
  },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function upsertAuthUser(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  name: string
) {
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    });
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  return data.user.id;
}

async function provision() {
  const supabase = createAdminClient();
  for (const u of TEST_USERS) {
    const userId = await upsertAuthUser(supabase, u.email, u.name);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        role: u.role,
        name: u.name,
        active: true,
        language: u.language,
      },
      create: {
        id: userId,
        email: u.email,
        name: u.name,
        role: u.role,
        language: u.language,
        active: true,
      },
    });
    console.log(`provisioned: ${u.email} (${u.role})`);
  }
  console.log("TEST_PASSWORD:", TEST_PASSWORD);
}

async function cleanup() {
  const supabase = createAdminClient();
  const emails = TEST_USERS.map((u) => u.email);

  for (const email of emails) {
    const row = await prisma.user.findUnique({ where: { email } });
    if (row) {
      await prisma.user.delete({ where: { email } });
      console.log(`deleted prisma user: ${email}`);
    }

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const authUser = authUsers?.users?.find((u) => u.email === email);
    if (authUser) {
      await supabase.auth.admin.deleteUser(authUser.id);
      console.log(`deleted auth user: ${email}`);
    }
  }

  const remaining = await prisma.user.count({
    where: { email: { in: emails } },
  });
  if (remaining !== 0) {
    throw new Error(`cleanup incomplete: ${remaining} test users remain`);
  }
  console.log("cleanup OK — no test users remain");
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "provision") {
    await provision();
  } else if (cmd === "cleanup") {
    await cleanup();
  } else {
    console.error("Usage: provision | cleanup");
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes(
  "_thai-cost-test-users"
);

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
