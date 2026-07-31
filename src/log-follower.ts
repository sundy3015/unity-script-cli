import { open } from "node:fs/promises";
import type { Writable } from "node:stream";

export class LogFollower {
  private readonly decoder = new TextDecoder("utf-8");
  private offset = 0;
  private timer?: NodeJS.Timeout;
  private pending: Promise<void> = Promise.resolve();
  private warned = false;

  constructor(
    private readonly logPath: string,
    private readonly output: Writable = process.stdout,
    private readonly warningOutput: Writable = process.stderr,
    private readonly intervalMilliseconds = 100,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.poll(), this.intervalMilliseconds);
  }

  poll(): Promise<void> {
    return this.enqueueRead(false);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.enqueueRead(true);
    const remainingText = this.decoder.decode();
    if (remainingText) this.output.write(remainingText);
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
      if (stats.size < this.offset) this.offset = 0;
      const byteCount = stats.size - this.offset;
      if (byteCount <= 0) return;

      const buffer = Buffer.alloc(byteCount);
      const { bytesRead } = await file.read(buffer, 0, byteCount, this.offset);
      this.offset += bytesRead;
      const text = this.decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
      if (text) this.output.write(text);
    } finally {
      await file.close();
    }
  }

  private warn(error: unknown): void {
    if (this.warned) return;
    this.warned = true;
    const message = error instanceof Error ? error.message : String(error);
    this.warningOutput.write(`[Unity CLI] 警告: 无法跟踪日志文件 ${this.logPath}: ${message}\n`);
  }
}
