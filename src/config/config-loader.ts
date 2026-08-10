import { readFile } from "node:fs/promises";
import path from "node:path";
import type { UnityCliConfig } from "./unity-cli-config.js";

export async function loadConfig(configPath: string): Promise<UnityCliConfig> {
  const absoluteConfigPath = path.resolve(configPath);
  let value: unknown;

  try {
    value = JSON.parse(await readFile(absoluteConfigPath, "utf8"));
  } catch (error) {
    throw new Error(`无法读取配置文件 ${absoluteConfigPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("配置根节点必须是对象");
  }

  const config = value as Record<string, unknown>;
  assertNonEmptyString(config, "unityExe");
  assertNonEmptyString(config, "projectPath");
  assertNonEmptyString(config, "runMethod");
  assertNonEmptyString(config, "unityLog");
  if (typeof config.quit !== "boolean") {
    throw new Error("配置项 quit 必须是布尔值");
  }
  if (config.timeoutSeconds !== undefined &&
      (typeof config.timeoutSeconds !== "number" || !Number.isFinite(config.timeoutSeconds) ||
       config.timeoutSeconds <= 0 || config.timeoutSeconds > 86_400)) {
    throw new Error("配置项 timeoutSeconds 必须是大于 0 且不超过 86400 的有限数字");
  }
  if (config.noGraphics === undefined) {
    config.noGraphics = true;
  } else if (typeof config.noGraphics !== "boolean") {
    throw new Error("配置项 noGraphics 必须是布尔值");
  }

  return config as unknown as UnityCliConfig;
}

function assertNonEmptyString(config: Record<string, unknown>, key: string): void {
  if (typeof config[key] !== "string" || config[key].trim() === "") {
    throw new Error(`配置项 ${key} 必须是非空字符串`);
  }
}
