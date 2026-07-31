import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config/config-loader.js";

const validConfig = {
  unityExe: "C:\\Unity\\Unity.exe",
  projectPath: "E:\\game",
  runMethod: "Tools.Verify.Run",
  unityLog: "logs\\unity.log",
  quitOnComplete: true,
};

async function withConfig(content: string, action: (configPath: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "unity-script-cli-"));
  const configPath = path.join(directory, "config.json");
  try {
    await writeFile(configPath, content, "utf8");
    await action(configPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("loadConfig loads a complete config", async () => {
  await withConfig(JSON.stringify(validConfig), async (configPath) => {
    assert.deepEqual(await loadConfig(configPath), validConfig);
  });
});

test("loadConfig rejects a missing field", async () => {
  const { runMethod: _runMethod, ...incompleteConfig } = validConfig;
  await withConfig(JSON.stringify(incompleteConfig), async (configPath) => {
    await assert.rejects(loadConfig(configPath), /runMethod/);
  });
});

test("loadConfig rejects a field with the wrong type", async () => {
  await withConfig(JSON.stringify({ ...validConfig, quitOnComplete: "true" }), async (configPath) => {
    await assert.rejects(loadConfig(configPath), /quitOnComplete.*布尔值/);
  });
});

test("loadConfig rejects invalid JSON", async () => {
  await withConfig("{ invalid json", async (configPath) => {
    await assert.rejects(loadConfig(configPath), /无法读取配置文件/);
  });
});
