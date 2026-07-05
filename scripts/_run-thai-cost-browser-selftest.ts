/**
 * Full browser self-test with temp users: provision → test → cleanup (always).
 * Run: npx tsx --env-file=.env.local scripts/_run-thai-cost-browser-selftest.ts
 */
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

async function run(cmd: string, args: string[]) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function waitForServer(url: string, ms = 120000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok || res.status === 307 || res.status === 302) {
        console.log("server ready:", url);
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Server not ready: ${url}`);
}

async function main() {
  let devProc: ReturnType<typeof spawn> | null = null;
  let startedDev = false;

  try {
    try {
      await waitForServer("http://localhost:3000/login", 8000);
      console.log("using existing dev server on :3000");
    } catch {
      console.log("starting next dev on :3000 ...");
      devProc = spawn("npm", ["run", "dev"], {
        cwd: process.cwd(),
        shell: true,
        stdio: "ignore",
        detached: process.platform !== "win32",
      });
      startedDev = true;
      await waitForServer("http://localhost:3000/login", 180000);
    }

    await run("npx", [
      "tsx",
      "--env-file=.env.local",
      "scripts/_thai-cost-test-users.ts",
      "provision",
    ]);
    await run("npx", [
      "tsx",
      "--env-file=.env.local",
      "scripts/_selftest-thai-cost-i18n-perms.ts",
    ]);
  } finally {
    try {
      await run("npx", [
        "tsx",
        "--env-file=.env.local",
        "scripts/_thai-cost-test-users.ts",
        "cleanup",
      ]);
    } catch (e) {
      console.error("CLEANUP FAILED — manual cleanup required:", e);
      process.exitCode = 1;
    }

    if (startedDev && devProc?.pid) {
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(devProc.pid), "/t", "/f"], {
            shell: true,
            stdio: "ignore",
          });
        } else {
          process.kill(-devProc.pid!, "SIGTERM");
        }
      } catch {
        /* ignore */
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
