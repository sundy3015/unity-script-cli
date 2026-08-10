import { once } from "node:events";
import { open } from "node:fs/promises";
import type { Writable } from "node:stream";
import { StringDecoder } from "node:string_decoder";

const DEFAULT_POLL_INTERVAL_MS = 100;   // 100 毫秒
const DEFAULT_CHUNK_SIZE = 64 * 1024;   // 64 KB

export interface LogFollowerOptions {
  output?: Writable;
  warningOutput?: Writable;
  pollIntervalMs?: number;
  chunkSize?: number;
}

export class LogFollower {
  private decoder = new StringDecoder("utf8");
  private atFileStart = true;
  private readonly output: Writable;
  private readonly warningOutput: Writable;
  private readonly pollIntervalMs: number;
  private readonly buffer: Buffer;
  private offset = 0;
  private fileIdentity?: string;
  private timer?: NodeJS.Timeout;
  private pending: Promise<void> = Promise.resolve();
  private stopPromise?: Promise<void>;
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
    if (this.timer || this.stopPromise) return;

    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  poll(): Promise<void> {
    if (this.stopPromise) return this.pending;
    return this.enqueueRead(false);
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    if (this.timer) clearInterval(this.timer);

    this.stopPromise = (async () => {
      await this.enqueueRead(true);
      try {
        const remainingText = this.removeBom(this.decoder.end());
        if (remainingText) await this.writeOutput(remainingText);
      } catch (error) {
        this.warn(error);
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
    const file = await open(this.logPath, "r");                                                 // 以只读模式打开日志文件
    try {
      const stats = await file.stat();                                                          // 获取文件状态信息
      const identity = `${stats.dev}:${stats.ino}:${stats.birthtimeMs}`;                        // 生成文件唯一标识符
      const fileReplaced = this.fileIdentity !== undefined && this.fileIdentity !== identity;
      if (fileReplaced || stats.size < this.offset) {                                           // 文件被替换或截断，重置跟踪状态
        this.resetTracking();
      }
      this.fileIdentity = identity;

      const targetOffset = stats.size;
      while (this.offset < targetOffset) {
        const bytesToRead = Math.min(this.buffer.length, targetOffset - this.offset);
        const { bytesRead } = await file.read(this.buffer, 0, bytesToRead, this.offset);      // 从指定偏移量读取日志文件内容
        if (bytesRead === 0) break;

        this.offset += bytesRead;
        const text = this.removeBom(this.decoder.write(this.buffer.subarray(0, bytesRead)));  // 将读取的字节转换为字符串，并移除 BOM
        if (text) await this.writeOutput(text);
      }
    } finally {
      await file.close();
    }
  }

  // 重置跟踪状态，包括偏移量、解码器和文件起始标记
  private resetTracking(): void {
    this.offset = 0;
    this.decoder = new StringDecoder("utf8");
    this.atFileStart = true;
  }

  // 移除 UTF-8 BOM（字节顺序标记）以确保输出的文本不包含 BOM
  private removeBom(text: string): string {
    if (!this.atFileStart || text.length === 0) return text;
    this.atFileStart = false;
    return text.startsWith("\uFEFF") ? text.slice(1) : text;
  }

  // 将日志内容写入输出流，如果输出流的缓冲区已满，则等待 "drain" 事件
  private async writeOutput(text: string): Promise<void> {
    if (this.output.write(text)) return;                    // 如果写入成功，直接返回
    await once(this.output, "drain");                       // 等待输出流的 "drain" 事件，确保缓冲区已清空
  }

  // 记录警告信息，确保只记录一次警告
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
