import { execSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit" });
}

function migrateDeploy() {
  return spawnSync("npx", ["prisma", "migrate", "deploy"], {
    encoding: "utf8",
  });
}

function listMigrations() {
  return readdirSync(join("prisma", "migrations")).filter(
    (name) => !name.startsWith(".") && name !== "migration_lock.toml"
  );
}

function baselineExistingDatabase() {
  console.log(
    "\n[P3005] Database has schema but no migration history; syncing with db push..."
  );
  run("npx prisma db push");
  for (const migration of listMigrations()) {
    run(`npx prisma migrate resolve --applied ${migration}`);
  }
}

const migrate = migrateDeploy();
const output = `${migrate.stdout ?? ""}${migrate.stderr ?? ""}`;

if (migrate.stdout) process.stdout.write(migrate.stdout);
if (migrate.stderr) process.stderr.write(migrate.stderr);

if (migrate.status !== 0) {
  if (output.includes("P3005")) {
    baselineExistingDatabase();
    const retry = migrateDeploy();
    if (retry.stdout) process.stdout.write(retry.stdout);
    if (retry.stderr) process.stderr.write(retry.stderr);
    if (retry.status !== 0) {
      process.exit(retry.status ?? 1);
    }
  } else {
    process.exit(migrate.status ?? 1);
  }
}

run("npx prisma generate");
run("npx next build");
