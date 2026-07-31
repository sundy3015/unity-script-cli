import assert from "node:assert/strict";
import { appendFile, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { LogFollower } from "../src/logging/log-follower.js";

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
    const follower = new LogFollower(logPath, { output: output.stream });

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
    const follower = new LogFollower(logPath, { output: output.stream, chunkSize: 2 });
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
    const follower = new LogFollower(logPath, { output: output.stream });

    await appendFile(logPath, "last line\n");
    await follower.stop();

    assert.equal(output.read(), "last line\n");
  });
});

test("LogFollower reads large additions in fixed-size chunks", async () => {
  await withLogFile(async (logPath) => {
    const output = captureOutput();
    const follower = new LogFollower(logPath, { output: output.stream, chunkSize: 8 });
    const content = "0123456789".repeat(20);

    await appendFile(logPath, content);
    await follower.poll();
    await follower.stop();

    assert.equal(output.read(), content);
  });
});

test("LogFollower restarts from the beginning after truncation", async () => {
  await withLogFile(async (logPath) => {
    const output = captureOutput();
    const follower = new LogFollower(logPath, { output: output.stream });

    await writeFile(logPath, "old content\n");
    await follower.poll();
    await writeFile(logPath, "new\n");
    await follower.poll();
    await follower.stop();

    assert.equal(output.read(), "old content\nnew\n");
  });
});

test("LogFollower reads a replacement file from the beginning", async () => {
  await withLogFile(async (logPath) => {
    const output = captureOutput();
    const follower = new LogFollower(logPath, { output: output.stream });
    const previousPath = `${logPath}.previous`;

    await writeFile(logPath, "old\n");
    await follower.poll();
    await rename(logPath, previousPath);
    await writeFile(logPath, "replacement content\n");
    await follower.poll();
    await follower.stop();

    assert.equal(output.read(), "old\nreplacement content\n");
  });
});

class ControlledWritable extends Writable {
  value = "";
  private writeCallback?: (error?: Error | null) => void;
  private readonly writeStarted: Promise<void>;
  private markWriteStarted!: () => void;

  constructor() {
    super({ highWaterMark: 1 });
    this.writeStarted = new Promise((resolve) => this.markWriteStarted = resolve);
  }

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.value += chunk.toString();
    this.writeCallback = callback;
    this.markWriteStarted();
  }

  waitForWrite(): Promise<void> {
    return this.writeStarted;
  }

  release(): void {
    const callback = this.writeCallback;
    this.writeCallback = undefined;
    callback?.();
  }
}

test("LogFollower waits for output backpressure", async () => {
  await withLogFile(async (logPath) => {
    const output = new ControlledWritable();
    const follower = new LogFollower(logPath, { output, chunkSize: 4 });
    await writeFile(logPath, "data");

    let completed = false;
    const poll = follower.poll().then(() => completed = true);
    await output.waitForWrite();
    assert.equal(completed, false);

    output.release();
    await poll;
    await follower.stop();
    assert.equal(output.value, "data");
  });
});

test("LogFollower start and stop are idempotent", async () => {
  await withLogFile(async (logPath) => {
    const output = captureOutput();
    const follower = new LogFollower(logPath, { output: output.stream, pollIntervalMs: 60_000 });

    follower.start();
    follower.start();
    await appendFile(logPath, "once\n");
    const firstStop = follower.stop();
    const secondStop = follower.stop();

    assert.equal(firstStop, secondStop);
    await firstStop;
    assert.equal(output.read(), "once\n");
  });
});

test("LogFollower recovers when a temporarily missing file appears", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "unity-log-follower-missing-"));
  const logPath = path.join(directory, "unity.log");
  try {
    const output = captureOutput();
    const warning = captureOutput();
    const follower = new LogFollower(logPath, { output: output.stream, warningOutput: warning.stream });

    await follower.poll();
    await writeFile(logPath, "available\n");
    await follower.poll();
    await follower.stop();

    assert.equal(output.read(), "available\n");
    assert.equal(warning.read(), "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("LogFollower warns once when the file is still missing at stop", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "unity-log-follower-warning-"));
  const logPath = path.join(directory, "unity.log");
  try {
    const warning = captureOutput();
    const follower = new LogFollower(logPath, { warningOutput: warning.stream });

    await follower.poll();
    await follower.stop();
    await follower.stop();

    assert.match(warning.read(), /日志跟踪失败/);
    assert.equal(warning.read().match(/日志跟踪失败/g)?.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
