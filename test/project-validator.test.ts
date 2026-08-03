import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateUnityProject } from "../src/unity/unity-project-validator.js";

async function withUnityProject(action: (projectPath: string, unityExe: string) => Promise<void>): Promise<void> {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "unity-project-validator-"));
  const unityExe = path.join(projectPath, "Unity.exe");
  try {
    await writeFile(unityExe, "");
    await mkdir(path.join(projectPath, "Assets"));
    await mkdir(path.join(projectPath, "ProjectSettings"));
    await action(projectPath, unityExe);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

function createConfig(projectPath: string, unityExe: string) {
  return {
    unityExe,
    projectPath,
    runMethod: "Tools.Verify.Run",
    unityLog: "unity.log",
    quitOnComplete: true,
  };
}

test("validateUnityProject accepts the expected path types", async () => {
  await withUnityProject(async (projectPath, unityExe) => {
    await validateUnityProject(createConfig(projectPath, unityExe));
  });
});

test("validateUnityProject rejects a directory used as unityExe", async () => {
  await withUnityProject(async (projectPath) => {
    await assert.rejects(validateUnityProject(createConfig(projectPath, projectPath)), /不是文件/);
  });
});

test("validateUnityProject rejects a file used as Assets", async () => {
  await withUnityProject(async (projectPath, unityExe) => {
    await rm(path.join(projectPath, "Assets"), { recursive: true });
    await writeFile(path.join(projectPath, "Assets"), "");
    await assert.rejects(validateUnityProject(createConfig(projectPath, unityExe)), /Assets.*不是目录/);
  });
});
