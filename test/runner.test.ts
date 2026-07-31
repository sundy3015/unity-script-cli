import assert from "node:assert/strict";
import test from "node:test";
import { buildUnityArgs } from "../src/runner.js";

const options = {
  unityExe: "Unity.exe",
  projectPath: "E:\\game",
  runMethod: "Tools.Verify.Run",
  unityLog: "E:\\logs\\unity.log",
  quitOnComplete: true,
};

test("buildUnityArgs builds arguments from config", () => {
  assert.deepEqual(buildUnityArgs(options), [
    "-batchmode", "-projectPath", "E:\\game", "-executeMethod", "Tools.Verify.Run",
    "-logFile", "E:\\logs\\unity.log", "-quit",
  ]);
});

test("buildUnityArgs can keep Unity open", () => {
  const args = buildUnityArgs({ ...options, quitOnComplete: false });
  assert.equal(args.includes("-quit"), false);
});
