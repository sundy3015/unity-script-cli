import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UnityCliConfig } from "../config/unity-cli-config.js";
import { LogFollower } from "../logging/log-follower.js";

export class UnityCliRunner {
  constructor(private readonly options: UnityCliConfig) {}

  buildArgs(): string[] {
    const args = [
      "-batchmode",
    ];

    if (this.options.noGraphics !== false) args.push("-nographics");
    args.push(
      "-projectPath", this.options.projectPath,
      "-executeMethod", this.options.runMethod,
      "-logFile", this.options.unityLog,
    );

    if (this.options.quit) args.push("-quit");
    if (this.options.noGraphics) args.push("-nographics");
    return args;
  }

  async run(): Promise<number> {
    const args = this.buildArgs();
    console.log("[Unity CLI] 正在启动 Unity...");
    console.log(`[Unity CLI] 启动参数: ${args.join(" ")}`);

    await mkdir(path.dirname(path.resolve(this.options.unityLog)), { recursive: true });
    await writeFile(this.options.unityLog, "", "utf8");

    const logFollower = new LogFollower(this.options.unityLog);
    logFollower.start();

    return new Promise((resolve, reject) => {
      const child = spawn(this.options.unityExe, args, {
        stdio: ["ignore", "ignore", "inherit"],   // 忽略 Unity 的 stdout，继承 stderr
      });

      let settled = false;
      let timeoutError: Error | undefined;
      const timeoutTimer = this.options.timeoutSeconds === undefined
        ? undefined
        : setTimeout(() => {
            if (settled || timeoutError) return;

            timeoutError = new Error(`Unity 执行超时（${this.options.timeoutSeconds} 秒）`);
            console.error(`[Unity CLI] ${timeoutError.message}`);

            try {
              if (child.kill()) return;
              timeoutError = new Error(`${timeoutError.message}，无法终止 Unity 进程`);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              timeoutError = new Error(`${timeoutError.message}，终止 Unity 进程失败: ${message}`);
            }

            settled = true;
            void logFollower.stop().then(() => reject(timeoutError));
          }, this.options.timeoutSeconds * 1000);

      const clearRunTimeout = (): void => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
      };

      child.once("error", (error) => {
        if (settled) return;

        settled = true;
        clearRunTimeout();
        const finalError = timeoutError ?? error;
        if (!timeoutError) console.error("[Unity CLI] Unity 启动失败:", error);
        void logFollower.stop().then(() => reject(finalError));
      });

      child.once("close", (code, signal) => {
        if (settled) return;

        settled = true;
        clearRunTimeout();
        console.log(`[Unity CLI] Unity 进程已退出，退出码: ${code}, 信号: ${signal}`);
        void logFollower.stop().then(() => {
          if (timeoutError) reject(timeoutError);
          else if (signal) reject(new Error(`Unity 被信号 ${signal} 终止`));
          else resolve(code ?? 1);
        });
        
      });
    });
  }
}
