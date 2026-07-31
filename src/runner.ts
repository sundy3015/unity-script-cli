import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LogFollower } from "./log-follower.js";

export interface RunOptions {
  unityExe: string;
  projectPath: string;
  runMethod: string;
  unityLog: string;
  quitOnComplete: boolean;
}

export function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} 秒`;
}

export function formatCompletion(exitCode: number, elapsedMilliseconds: number): string {
  const status = exitCode === 0 ? "成功" : "失败";
  return `[Unity CLI] 任务${status}，退出码: ${exitCode}，耗时: ${formatDuration(elapsedMilliseconds)}`;
}

export function buildUnityArgs(options: RunOptions): string[] {
  const args = [
    "-batchmode",
    "-projectPath", options.projectPath,
    "-executeMethod", options.runMethod,
    "-logFile", options.unityLog,
  ];

  if (options.quitOnComplete) args.push("-quit");
  return args;
}

export async function runUnity(options: RunOptions): Promise<number> {
  await mkdir(path.dirname(path.resolve(options.unityLog)), { recursive: true });
  await writeFile(options.unityLog, "", "utf8");
  const logFollower = new LogFollower(options.unityLog);
  logFollower.start();

  return new Promise((resolve, reject) => {
    const child = spawn(options.unityExe, buildUnityArgs(options), {
      stdio: ["ignore", "ignore", "inherit"],
    });

    let settled = false;
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      void logFollower.stop().then(() => reject(error));
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      void logFollower.stop().then(() => {
        if (signal) reject(new Error(`Unity 被信号 ${signal} 终止`));
        else resolve(code ?? 1);
      });
    });
  });
}
