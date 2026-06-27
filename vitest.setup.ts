import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://vitest:vitest@127.0.0.1:5432/vitest?schema=public";
}
