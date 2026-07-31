import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface UnityCliConfig {
  unityExe: string;
  projectPath: string;
  runMethod: string;
  unityLog: string;
  quitOnComplete: boolean;
}

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
  if (typeof config.quitOnComplete !== "boolean") {
    throw new Error("配置项 quitOnComplete 必须是布尔值");
  }

  return config as unknown as UnityCliConfig;
}

export async function validatePaths(config: UnityCliConfig): Promise<void> {
  await assertAccessible(config.unityExe, "Unity 可执行文件");
  await assertAccessible(config.projectPath, "Unity 项目目录");
  await assertAccessible(path.join(config.projectPath, "Assets"), "Unity Assets 目录");
  await assertAccessible(path.join(config.projectPath, "ProjectSettings"), "Unity ProjectSettings 目录");
}

function assertNonEmptyString(config: Record<string, unknown>, key: string): void {
  if (typeof config[key] !== "string" || config[key].trim() === "") {
    throw new Error(`配置项 ${key} 必须是非空字符串`);
  }
}

async function assertAccessible(target: string, label: string): Promise<void> {
  try {
    await access(target);
  } catch {
    throw new Error(`${label}不存在或不可访问: ${target}`);
  }
}
