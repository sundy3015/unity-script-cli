#!/usr/bin/env node
import path from "node:path";
import { loadConfig, validatePaths } from "./config.js";
import { formatCompletion, runUnity } from "./runner.js";

const CONFIG_PATH = "unity-cli.config.json";

async function run(): Promise<number> {
  const config = await loadConfig(CONFIG_PATH);
  await validatePaths(config);

  const unityLog = path.isAbsolute(config.unityLog)
    ? config.unityLog
    : path.resolve(path.dirname(CONFIG_PATH), config.unityLog);

  return runUnity({
    unityExe: config.unityExe,
    projectPath: config.projectPath,
    runMethod: config.runMethod,
    unityLog,
    quitOnComplete: config.quitOnComplete,
  });
}

async function main(): Promise<void> {
  const startTime = Date.now();
  try {
    const exitCode = await run();
    console.log(formatCompletion(exitCode, Date.now() - startTime));
    process.exitCode = exitCode;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${formatCompletion(1, Date.now() - startTime)}，原因: ${message}`);
    process.exitCode = 1;
  }
}

void main();
