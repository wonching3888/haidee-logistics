import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isReadDbOperation, withDbRetry } from "@/lib/db-retry";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          if (!isReadDbOperation(operation)) {
            return query(args);
          }

          return withDbRetry(() => query(args), {
            label: `${model}.${operation}`,
          });
        },
      },
    },
  }) as unknown as PrismaClient;
}

/** Singleton Prisma client — reused across hot reloads and serverless invocations. */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
