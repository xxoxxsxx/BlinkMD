import { execFileSync, spawn } from "node:child_process";
import process from "node:process";

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

function getChildPids(parentPid) {
  try {
    const output = execFileSync("pgrep", ["-P", String(parentPid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    if (!output) {
      return [];
    }
    return output
      .split(/\s+/)
      .map((item) => Number(item))
      .filter((value) => Number.isFinite(value));
  } catch (error) {
    const text = String(error?.stderr ?? error?.message ?? "");
    if (/operation not permitted|sysmond service not found|cannot get process list/i.test(text)) {
      return null;
    }
    return [];
  }
}

function getProcessTreePids(rootPid) {
  const visited = new Set([rootPid]);
  const stack = [rootPid];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const children = getChildPids(current);
    if (children === null) {
      return null;
    }
    for (const childPid of children) {
      if (!visited.has(childPid)) {
        visited.add(childPid);
        stack.push(childPid);
      }
    }
  }

  return Array.from(visited);
}

function getRssKbForPids(pids) {
  if (pids.length === 0) {
    return 0;
  }

  try {
    const output = execFileSync("ps", ["-o", "rss=", "-p", pids.join(",")], {
      encoding: "utf8"
    });
    return output
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);
  } catch (error) {
    const text = String(error?.stderr ?? error?.message ?? "");
    if (/operation not permitted|sysmond service not found/i.test(text)) {
      return -1;
    }
    return 0;
  }
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
  const startupTimeoutSec = Number(args["startup-timeout"] ?? process.env.MEASURE_STARTUP_TIMEOUT ?? 180);
  const durationSec = Number(args.duration ?? process.env.MEASURE_DURATION ?? 20);
  const intervalMs = Number(args.interval ?? process.env.MEASURE_INTERVAL ?? 1000);
  const readyPattern = new RegExp(readyPatternText, "i");

  console.log(`[measure-memory] command: ${command}`);
  console.log(`[measure-memory] ready pattern: /${readyPatternText}/i`);
  console.log(`[measure-memory] duration: ${durationSec}s, interval: ${intervalMs}ms`);

  const child = spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let resolved = false;
  let ready = false;
  let interval = null;
  let stopTimer = null;
  const samplesKb = [];
  let metricsPermissionDenied = false;

  const cleanupAndExit = async (code) => {
    if (resolved) {
      return;
    }
    resolved = true;
    if (interval) {
      clearInterval(interval);
    }
    if (stopTimer) {
      clearTimeout(stopTimer);
    }
    await terminateProcess(child);
    process.exitCode = code;
  };

  const finalize = async () => {
    if (!ready) {
      return cleanupAndExit(1);
    }

    if (samplesKb.length === 0) {
      if (metricsPermissionDenied) {
        console.error("[measure-memory] process metrics access denied. Please run on host terminal.");
        return cleanupAndExit(2);
      }
      console.error("[measure-memory] no memory samples collected.");
      return cleanupAndExit(1);
    }

    const maxKb = Math.max(...samplesKb);
    const minKb = Math.min(...samplesKb);
    const avgKb = Math.round(samplesKb.reduce((sum, value) => sum + value, 0) / samplesKb.length);
    const toMb = (kb) => (kb / 1024).toFixed(2);

    console.log(`[measure-memory] samples: ${samplesKb.length}`);
    console.log(`[measure-memory] min rss: ${toMb(minKb)} MB`);
    console.log(`[measure-memory] avg rss: ${toMb(avgKb)} MB`);
    console.log(`[measure-memory] max rss: ${toMb(maxKb)} MB`);
    return cleanupAndExit(0);
  };

  const tryMarkReady = () => {
    if (ready || !child.pid) {
      return;
    }

    ready = true;
    interval = setInterval(() => {
      const pids = getProcessTreePids(child.pid);
      if (pids === null) {
        metricsPermissionDenied = true;
        return;
      }
      const rssKb = getRssKbForPids(pids);
      if (rssKb < 0) {
        metricsPermissionDenied = true;
        return;
      }
      if (rssKb > 0) {
        samplesKb.push(rssKb);
      }
    }, intervalMs);

    stopTimer = setTimeout(() => {
      void finalize();
    }, durationSec * 1000);
  };

  const onData = (buffer) => {
    const text = buffer.toString();
    process.stdout.write(text);
    if (!ready && readyPattern.test(text)) {
      tryMarkReady();
    }
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  child.on("close", async (code) => {
    if (!resolved) {
      if (!ready) {
        console.error(`[measure-memory] process exited before ready. exit code: ${code ?? -1}`);
      }
      await finalize();
    }
  });

  setTimeout(async () => {
    if (!ready && !resolved) {
      console.error(`[measure-memory] timeout after ${startupTimeoutSec}s before ready.`);
      await cleanupAndExit(1);
    }
  }, startupTimeoutSec * 1000);
}

await main();
