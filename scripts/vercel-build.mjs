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

function resolveFailedMigration(output) {
  const failedMatch =
    output.match(/The `([^`]+)` migration/) ??
    output.match(/Migration name:\s*([^\s\r\n]+)/);
  const failedMigration = failedMatch?.[1];
  if (!failedMigration) {
    console.error("[P3009] Could not parse failed migration name from output.");
    return false;
  }

  // Column/table may already exist from a prior manual apply; mark rolled-back
  // then re-apply (migrations must be idempotent with IF NOT EXISTS).
  console.log(
    `[P3009/P3018] Resolving failed migration as rolled back: ${failedMigration}`
  );
  run(`npx prisma migrate resolve --rolled-back ${failedMigration}`);
  return true;
}

function migrateDeployWithRecovery() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const migrate = migrateDeploy();
    const output = `${migrate.stdout ?? ""}${migrate.stderr ?? ""}`;

    if (migrate.stdout) process.stdout.write(migrate.stdout);
    if (migrate.stderr) process.stderr.write(migrate.stderr);

    if (migrate.status === 0) {
      return;
    }

    if (output.includes("P3005")) {
      baselineExistingDatabase();
      continue;
    }

    if (
      (output.includes("P3009") || output.includes("P3018")) &&
      resolveFailedMigration(output)
    ) {
      continue;
    }

    process.exit(migrate.status ?? 1);
  }

  process.exit(1);
}

migrateDeployWithRecovery();

run("npx prisma generate");
run("npx next build");
