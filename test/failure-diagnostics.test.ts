import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { analyzeUnityLog, diagnoseUnityFailure } from "../src/unity/unity-failure-diagnostics.js";

test("project already open takes priority over fatal exit", () => {
  const log = [
    "Fatal Error! It looks like another Unity instance is running with this project open.",
    "Multiple Unity instances cannot open the same project.",
    "Project: E:/aov/trunk/Project",
    "Crash!!!",
  ].join("\n");
  assert.equal(analyzeUnityLog(log), "Unity 项目已被另一个实例打开: E:/aov/trunk/Project");
});

test("captures the project path before the project-open error", () => {
  const log = [
    "Project: E:/aov/trunk/Project",
    "Multiple Unity instances cannot open the same project.",
  ].join("\n");
  assert.equal(analyzeUnityLog(log), "Unity 项目已被另一个实例打开: E:/aov/trunk/Project");
});

test("recognizes compilation failure", () => {
  assert.equal(analyzeUnityLog("Aborting batchmode due to failure:\nScripts have compiler errors."), "Unity 项目脚本编译失败");
});

test("recognizes missing executeMethod", () => {
  assert.equal(analyzeUnityLog("executeMethod method 'Run' could not be found."), "Unity executeMethod 指定的类或方法不存在");
});

test("recognizes executeMethod exception", () => {
  assert.equal(analyzeUnityLog("Exception while executing method Tools.Verify.Run"), "Unity executeMethod 执行时发生异常");
});

test("ignores transient licensing errors followed by success", () => {
  const log = "Failed to update license\n[Licensing::Client] Successfully updated license";
  assert.equal(analyzeUnityLog(log), "Unity 执行失败，未识别到具体原因");
});

test("recognizes final licensing failure", () => {
  assert.equal(analyzeUnityLog("No valid Unity Editor license found"), "Unity 授权失败");
});

test("recognizes fatal exit", () => {
  assert.equal(analyzeUnityLog("A crash has been intercepted by the crash handler."), "Unity 发生崩溃或致命退出");
});

test("empty and unknown logs use the generic reason", () => {
  assert.equal(analyzeUnityLog(""), "Unity 执行失败，未识别到具体原因");
  assert.equal(analyzeUnityLog("ordinary Unity output"), "Unity 执行失败，未识别到具体原因");
});

test("missing log reports a read warning without changing the failure reason", async () => {
  const missingPath = path.join(process.cwd(), `missing-unity-${Date.now()}.log`);
  const diagnosis = await diagnoseUnityFailure(missingPath);
  assert.equal(diagnosis.reason, "Unity 执行失败，未识别到具体原因");
  assert.match(diagnosis.warning ?? "", /诊断日志读取失败/);
});
