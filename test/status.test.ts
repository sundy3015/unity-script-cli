import assert from "node:assert/strict";
import test from "node:test";
import { formatCompletion, formatDuration } from "../src/runner.js";

test("formatDuration formats seconds with one decimal place", () => {
  assert.equal(formatDuration(12_345), "12.3 秒");
});

test("formatCompletion reports success", () => {
  assert.equal(formatCompletion(0, 12_345), "[Unity CLI] 任务成功，退出码: 0，耗时: 12.3 秒");
});

test("formatCompletion reports failure", () => {
  assert.equal(formatCompletion(2, 500), "[Unity CLI] 任务失败，退出码: 2，耗时: 0.5 秒");
});
