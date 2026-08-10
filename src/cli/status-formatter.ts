export function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} 秒`;
}

export function formatCompletion(exitCode: number, elapsedMilliseconds: number): string {
  const status = exitCode === 0 ? "成功" : "失败";
  return `[Unity CLI] 任务${status}，退出码: ${exitCode}，耗时: ${formatDuration(elapsedMilliseconds)}`;
}

export function formatFailureCompletion(
  exitCode: number,
  elapsedMilliseconds: number,
  reason: string,
  logPath: string,
  warning?: string,
): string {
  const hexadecimalExitCode = (exitCode >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const warningText = warning ? `，警告: ${warning}` : "";
  return `[Unity CLI] 任务失败，退出码: ${exitCode} (0x${hexadecimalExitCode})，耗时: ${formatDuration(elapsedMilliseconds)}，原因: ${reason}，日志: ${logPath}${warningText}`;
}
