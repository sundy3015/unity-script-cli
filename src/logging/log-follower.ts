import { open } from "node:fs/promises";
import type { Writable } from "node:stream";

const DEFAULT_POLL_INTERVAL_MS = 100;   // 100 毫秒
const DEFAULT_CHUNK_SIZE = 64 * 1024;   // 64 KB

export interface LogFollowerOptions {
  output?: Writable;
  warningOutput?: Writable;
  pollIntervalMs?: number;
  chunkSize?: number;
}

export class LogFollower {
  private decoder = new TextDecoder("utf-8");
  private readonly output: Writable;
  private readonly warningOutput: Writable;
  private readonly pollIntervalMs: number;
  private readonly buffer: Buffer;
  private offset = 0;
  private fileIdentity?: string;
  private timer?: NodeJS.Timeout;
  private pending: Promise<void> = Promise.resolve();
  private stopPromise?: Promise<void>;
  private started = false;
  private stopped = false;
  private warned = false;

  constructor(private readonly logPath: string, options: LogFollowerOptions = {}) {
    this.output = options.output ?? process.stdout;
    this.warningOutput = options.warningOutput ?? process.stderr;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;

    if (!Number.isInteger(this.pollIntervalMs) || this.pollIntervalMs <= 0) {
      throw new Error("日志轮询间隔必须是正整数");
    }
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("日志读取块大小必须是正整数");
    }
    this.buffer = Buffer.alloc(chunkSize);
  }

  start(): void {
    if (this.started || this.stopped) return;

    this.started = true;
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  poll(): Promise<void> {
    if (this.stopped || this.stopPromise) return this.pending;
    return this.enqueueRead(false);
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    if (this.timer) clearInterval(this.timer);

    this.stopPromise = (async () => {
      await this.enqueueRead(true);
      try {
        const remainingText = this.decoder.decode();
        if (remainingText) await this.writeOutput(remainingText);
      } catch (error) {
        this.warn(error);
      } finally {
        this.stopped = true;
      }
    })();
    return this.stopPromise;
  }

  private enqueueRead(finalRead: boolean): Promise<void> {
    this.pending = this.pending.then(async () => {
      try {
        await this.readNewContent();
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if (!finalRead && code === "ENOENT") return;
        this.warn(error);
      }
    });
    return this.pending;
  }

  private async readNewContent(): Promise<void> {
    const file = await open(this.logPath, "r");
    try {
      const stats = await file.stat();
      const identity = `${stats.dev}:${stats.ino}:${stats.birthtimeMs}`;
      if (this.fileIdentity !== undefined && this.fileIdentity !== identity) {
        this.resetTracking();
      } else if (stats.size < this.offset) {
        this.resetTracking();
      }
      this.fileIdentity = identity;

      const targetOffset = stats.size;
      while (this.offset < targetOffset) {
        const bytesToRead = Math.min(this.buffer.length, targetOffset - this.offset);
        const { bytesRead } = await file.read(this.buffer, 0, bytesToRead, this.offset);
        if (bytesRead === 0) break;

        this.offset += bytesRead;
        const text = this.decoder.decode(this.buffer.subarray(0, bytesRead), { stream: true });
        if (text) await this.writeOutput(text);
      }
    } finally {
      await file.close();
    }
  }

  private resetTracking(): void {
    this.offset = 0;
    this.decoder = new TextDecoder("utf-8");
  }

  private async writeOutput(text: string): Promise<void> {
    if (this.output.write(text)) return;
    await new Promise<void>((resolve, reject) => {
      const onDrain = (): void => {
        cleanup();
        resolve();
      };
      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };
      const cleanup = (): void => {
        this.output.off("drain", onDrain);
        this.output.off("error", onError);
      };
      this.output.once("drain", onDrain);
      this.output.once("error", onError);
    });
  }

  private warn(error: unknown): void {
    if (this.warned) return;
    this.warned = true;
    const message = error instanceof Error ? error.message : String(error);
    try {
      this.warningOutput.write(`[Unity CLI] 警告: 日志跟踪失败 ${this.logPath}: ${message}\n`);
    } catch {
      // 警告输出失败时保持 Unity 任务状态不变。
    }
  }
}
