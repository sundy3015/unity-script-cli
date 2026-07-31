export function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} 秒`;
}

export function formatCompletion(exitCode: number, elapsedMilliseconds: number): string {
  const status = exitCode === 0 ? "成功" : "失败";
  return `[Unity CLI] 任务${status}，退出码: ${exitCode}，耗时: ${formatDuration(elapsedMilliseconds)}`;
}
