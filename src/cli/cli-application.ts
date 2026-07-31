import path from "node:path";
import { loadConfig } from "../config/config-loader.js";
import { UnityCliRunner } from "../unity/unity-cli-runner.js";
import { validateUnityProject } from "../unity/unity-project-validator.js";
import { formatCompletion } from "./status-formatter.js";

export async function runCli(configPath: string): Promise<number> {
  const startTime = Date.now();

  try {
    const config = await loadConfig(configPath);
    await validateUnityProject(config);

    const unityLog = path.isAbsolute(config.unityLog)
      ? config.unityLog
      : path.resolve(path.dirname(configPath), config.unityLog);
    const runner = new UnityCliRunner({ ...config, unityLog });
    const exitCode = await runner.run();

    console.log(formatCompletion(exitCode, Date.now() - startTime));
    return exitCode;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${formatCompletion(1, Date.now() - startTime)}，原因: ${message}`);
    return 1;
  }
}
