import assert from "node:assert/strict";
import test from "node:test";
import { UnityCliRunner } from "../src/unity/unity-cli-runner.js";

const options = {
  unityExe: "Unity.exe",
  projectPath: "E:\\game",
  runMethod: "Tools.Verify.Run",
  unityLog: "E:\\logs\\unity.log",
  quitOnComplete: true,
};

test("UnityCliRunner.buildArgs builds arguments from config", () => {
  assert.deepEqual(new UnityCliRunner(options).buildArgs(), [
    "-batchmode", "-projectPath", "E:\\game", "-executeMethod", "Tools.Verify.Run",
    "-logFile", "E:\\logs\\unity.log", "-quit",
  ]);
});

test("UnityCliRunner.buildArgs can keep Unity open", () => {
  const args = new UnityCliRunner({ ...options, quitOnComplete: false }).buildArgs();
  assert.equal(args.includes("-quit"), false);
});
