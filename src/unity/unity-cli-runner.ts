import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UnityCliConfig } from "../config/unity-cli-config.js";
import { LogFollower } from "../logging/log-follower.js";

export interface UnityCliRunOptions extends UnityCliConfig {}

export class UnityCliRunner {
  constructor(private readonly options: UnityCliRunOptions) {}

  buildArgs(): string[] {
    const args = [
      "-batchmode",
      "-projectPath", this.options.projectPath,
      "-executeMethod", this.options.runMethod,
      "-logFile", this.options.unityLog,
    ];

    if (this.options.quitOnComplete) args.push("-quit");
    return args;
  }

  async run(): Promise<number> {
    console.log("[Unity CLI] 正在启动 Unity...");
    console.log(`[Unity CLI] 启动参数: ${this.buildArgs().join(" ")}`);

    await mkdir(path.dirname(path.resolve(this.options.unityLog)), { recursive: true });
    await writeFile(this.options.unityLog, "", "utf8");
    const logFollower = new LogFollower(this.options.unityLog);
    logFollower.start();

    return new Promise((resolve, reject) => {
      const child = spawn(this.options.unityExe, this.buildArgs(), {
        stdio: ["ignore", "ignore", "inherit"],   // 忽略 Unity 的 stdout，继承 stderr
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
}
