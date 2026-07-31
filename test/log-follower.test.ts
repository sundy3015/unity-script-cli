import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { LogFollower } from "../src/log-follower.js";

async function withLogFile(action: (logPath: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "unity-log-follower-"));
  const logPath = path.join(directory, "unity.log");
  try {
    await writeFile(logPath, "");
    await action(logPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function captureOutput(): { stream: PassThrough; read: () => string } {
  const stream = new PassThrough();
  let value = "";
  stream.on("data", (chunk: Buffer) => value += chunk.toString());
  return { stream, read: () => value };
}

test("LogFollower outputs appended content once and in order", async () => {
  await withLogFile(async (logPath) => {
    const output = captureOutput();
    const follower = new LogFollower(logPath, output.stream);

    await appendFile(logPath, "first\n");
    await follower.poll();
    await appendFile(logPath, "second\n");
    await follower.poll();
    await follower.poll();
    await follower.stop();

    assert.equal(output.read(), "first\nsecond\n");
  });
});

test("LogFollower decodes UTF-8 characters split across reads", async () => {
  await withLogFile(async (logPath) => {
    const output = captureOutput();
    const follower = new LogFollower(logPath, output.stream);
    const content = Buffer.from("中文日志");

    await writeFile(logPath, content.subarray(0, 2));
    await follower.poll();
    await appendFile(logPath, content.subarray(2));
    await follower.poll();
    await follower.stop();

    assert.equal(output.read(), "中文日志");
  });
});

test("LogFollower reads remaining content before stopping", async () => {
  await withLogFile(async (logPath) => {
    const output = captureOutput();
    const follower = new LogFollower(logPath, output.stream);

    await appendFile(logPath, "last line\n");
    await follower.stop();

    assert.equal(output.read(), "last line\n");
  });
});
