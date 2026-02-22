import { spawn } from "node:child_process";
import process from "node:process";
import { performance } from "node:perf_hooks";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const rawKey = token.slice(2);
    if (rawKey.includes("=")) {
      const [key, value] = rawKey.split("=", 2);
      result[key] = value;
      continue;
    }
    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      result[rawKey] = nextToken;
      index += 1;
      continue;
    }
    result[rawKey] = "true";
  }
  return result;
}

async function terminateProcess(child) {
  if (!child || child.killed || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGINT");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 3000);

    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.cmd ?? process.env.MEASURE_CMD ?? "npm run tauri dev";
  const readyPatternText = args.ready ?? process.env.MEASURE_READY ?? "ready in|Running";
  const timeoutSec = Number(args.timeout ?? process.env.MEASURE_TIMEOUT ?? 180);
  const readyPattern = new RegExp(readyPatternText, "i");
  const startAt = performance.now();

  console.log(`[measure-startup] command: ${command}`);
  console.log(`[measure-startup] ready pattern: /${readyPatternText}/i`);

  const child = spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let resolved = false;

  const cleanupAndExit = async (code) => {
    if (resolved) {
      return;
    }
    resolved = true;
    await terminateProcess(child);
    process.exitCode = code;
  };

  const onData = async (buffer) => {
    const text = buffer.toString();
    process.stdout.write(text);
    if (!resolved && readyPattern.test(text)) {
      const elapsedMs = Math.round(performance.now() - startAt);
      console.log(`[measure-startup] cold startup = ${elapsedMs} ms`);
      await cleanupAndExit(0);
    }
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  child.on("close", async (code) => {
    if (!resolved) {
      console.error(`[measure-startup] process exited before ready. exit code: ${code ?? -1}`);
      await cleanupAndExit(1);
    }
  });

  setTimeout(async () => {
    if (!resolved) {
      console.error(`[measure-startup] timeout after ${timeoutSec}s before ready.`);
      await cleanupAndExit(1);
    }
  }, timeoutSec * 1000);
}

await main();
