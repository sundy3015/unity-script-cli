import { access } from "node:fs/promises";
import path from "node:path";
import type { UnityCliConfig } from "../config/unity-cli-config.js";

export async function validateUnityProject(config: UnityCliConfig): Promise<void> {
  await assertAccessible(config.unityExe, "Unity 可执行文件");
  await assertAccessible(config.projectPath, "Unity 项目目录");
  await assertAccessible(path.join(config.projectPath, "Assets"), "Unity Assets 目录");
  await assertAccessible(path.join(config.projectPath, "ProjectSettings"), "Unity ProjectSettings 目录");
}

async function assertAccessible(target: string, label: string): Promise<void> {
  try {
    await access(target);
  } catch {
    throw new Error(`${label}不存在或不可访问: ${target}`);
  }
}
