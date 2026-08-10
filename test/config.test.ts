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
  noGraphics: false,
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

test("loadConfig enables noGraphics by default", async () => {
  const { noGraphics: _noGraphics, ...configWithoutNoGraphics } = validConfig;
  await withConfig(JSON.stringify(configWithoutNoGraphics), async (configPath) => {
    assert.deepEqual(await loadConfig(configPath), { ...configWithoutNoGraphics, noGraphics: true });
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

test("loadConfig rejects noGraphics with the wrong type", async () => {
  await withConfig(JSON.stringify({ ...validConfig, noGraphics: "true" }), async (configPath) => {
    await assert.rejects(loadConfig(configPath), /noGraphics.*布尔值/);
  });
});

test("loadConfig rejects invalid JSON", async () => {
  await withConfig("{ invalid json", async (configPath) => {
    await assert.rejects(loadConfig(configPath), /无法读取配置文件/);
  });
});

test("loadConfig allows timeoutSeconds to be omitted", async () => {
  await withConfig(JSON.stringify(validConfig), async (configPath) => {
    assert.equal((await loadConfig(configPath)).timeoutSeconds, undefined);
  });
});

test("loadConfig accepts a positive timeoutSeconds", async () => {
  await withConfig(JSON.stringify({ ...validConfig, timeoutSeconds: 30 }), async (configPath) => {
    assert.equal((await loadConfig(configPath)).timeoutSeconds, 30);
  });
});

test("loadConfig rejects an invalid timeoutSeconds", async () => {
  await withConfig(JSON.stringify({ ...validConfig, timeoutSeconds: 0 }), async (configPath) => {
    await assert.rejects(loadConfig(configPath), /timeoutSeconds/);
  });
});

test("loadConfig rejects timeoutSeconds over 24 hours", async () => {
  await withConfig(JSON.stringify({ ...validConfig, timeoutSeconds: 86_401 }), async (configPath) => {
    await assert.rejects(loadConfig(configPath), /timeoutSeconds/);
  });
});
