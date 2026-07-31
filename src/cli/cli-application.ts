import path from "node:path";
import { loadConfig } from "../config/config-loader.js";
import { UnityCliRunner } from "../unity/unity-cli-runner.js";
import { validateUnityProject } from "../unity/unity-project-validator.js";
import { diagnoseUnityFailure } from "../unity/unity-failure-diagnostics.js";
import { formatCompletion, formatFailureCompletion } from "./status-formatter.js";

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

    if (exitCode === 0) {
      console.log(formatCompletion(exitCode, Date.now() - startTime));
    } else {
      const diagnosis = await diagnoseUnityFailure(unityLog);
      console.log(formatFailureCompletion(
        exitCode,
        Date.now() - startTime,
        diagnosis.reason,
        unityLog,
        diagnosis.warning,
      ));
    }

    return exitCode;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${formatCompletion(1, Date.now() - startTime)}，原因: ${message}`);
    return 1;
  }
  finally {
    console.log("[Unity CLI] 运行结束");
  }
}
