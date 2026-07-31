import assert from "node:assert/strict";
import test from "node:test";
import { formatCompletion, formatDuration, formatFailureCompletion } from "../src/cli/status-formatter.js";

test("formatDuration formats seconds with one decimal place", () => {
  assert.equal(formatDuration(12_345), "12.3 秒");
});

test("formatCompletion reports success", () => {
  assert.equal(formatCompletion(0, 12_345), "[Unity CLI] 任务成功，退出码: 0，耗时: 12.3 秒");
});

test("formatCompletion reports failure", () => {
  assert.equal(formatCompletion(2, 500), "[Unity CLI] 任务失败，退出码: 2，耗时: 0.5 秒");
});

test("formatFailureCompletion includes hexadecimal exit code and diagnosis", () => {
  assert.equal(
    formatFailureCompletion(1073741845, 6_400, "Unity 项目已被另一个实例打开: E:\\game", "E:\\logs\\unity.log"),
    "[Unity CLI] 任务失败，退出码: 1073741845 (0x40000015)，耗时: 6.4 秒，原因: Unity 项目已被另一个实例打开: E:\\game，日志: E:\\logs\\unity.log",
  );
});

test("formatFailureCompletion includes diagnostic warning", () => {
  assert.match(formatFailureCompletion(2, 500, "未知", "unity.log", "无法读取"), /警告: 无法读取$/);
});
