import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE_SALARY_MYR = 1700;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const result = await prisma.driver.updateMany({
    where: { active: true },
    data: { baseSalary: BASE_SALARY_MYR },
  });

  const drivers = await prisma.driver.findMany({
    where: { active: true },
    select: { name: true, baseSalary: true },
    orderBy: { name: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        updatedCount: result.count,
        activeDriverCount: drivers.length,
        baseSalaryMyr: BASE_SALARY_MYR,
        drivers: drivers.map((driver) => ({
          name: driver.name,
          baseSalary: Number(driver.baseSalary),
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
