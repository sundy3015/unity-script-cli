import { stat } from "node:fs/promises";
import path from "node:path";
import type { UnityCliConfig } from "../config/unity-cli-config.js";

export async function validateUnityProject(config: UnityCliConfig): Promise<void> {
  await assertFile(config.unityExe, "Unity 可执行文件");
  await assertDirectory(config.projectPath, "Unity 项目目录");
  await assertDirectory(path.join(config.projectPath, "Assets"), "Unity Assets 目录");
  await assertDirectory(path.join(config.projectPath, "ProjectSettings"), "Unity ProjectSettings 目录");
}

async function assertFile(target: string, label: string): Promise<void> {
  try {
    if (!(await stat(target)).isFile()) throw new Error("不是文件");
  } catch {
    throw new Error(`${label}不存在、不可访问或不是文件: ${target}`);
  }
}

async function assertDirectory(target: string, label: string): Promise<void> {
  try {
    if (!(await stat(target)).isDirectory()) throw new Error("不是目录");
  } catch {
    throw new Error(`${label}不存在、不可访问或不是目录: ${target}`);
  }
}
