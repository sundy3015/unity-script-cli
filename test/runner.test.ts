import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { UnityCliRunner } from "../src/unity/unity-cli-runner.js";

const options = {
  unityExe: "Unity.exe",
  projectPath: "E:\\game",
  runMethod: "Tools.Verify.Run",
  unityLog: "E:\\logs\\unity.log",
  quit: true,
  noGraphics: true,
};

test("UnityCliRunner.buildArgs builds arguments from config", () => {
  assert.deepEqual(new UnityCliRunner(options).buildArgs(), [
    "-batchmode", "-projectPath", "E:\\game", "-executeMethod", "Tools.Verify.Run",
    "-logFile", "E:\\logs\\unity.log", "-quit", "-nographics",
  ]);
});

test("UnityCliRunner.buildArgs can keep Unity open", () => {
  const args = new UnityCliRunner({ ...options, quit: false }).buildArgs();
  assert.equal(args.includes("-quit"), false);
});

test("UnityCliRunner does not print close status after a spawn error", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "unity-cli-spawn-error-"));
  const messages: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => messages.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => messages.push(args.map(String).join(" "));

  try {
    const runner = new UnityCliRunner({
      ...options,
      unityExe: path.join(directory, "missing-unity.exe"),
      unityLog: path.join(directory, "unity.log"),
    });

    await assert.rejects(runner.run());
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(messages.filter((message) => message.includes("Unity 启动失败")).length, 1);
    assert.equal(messages.some((message) => message.includes("Unity 进程已退出")), false);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    await rm(directory, { recursive: true, force: true });
  }
});

test("UnityCliRunner.buildArgs can enable graphics", () => {
  const args = new UnityCliRunner({ ...options, noGraphics: false }).buildArgs();
  assert.equal(args.includes("-nographics"), false);
});

