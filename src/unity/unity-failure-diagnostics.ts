import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export interface UnityFailureDiagnosis {
  reason: string;
  warning?: string;
}

interface DiagnosticState {
  projectAlreadyOpen: boolean;
  projectPath?: string;
  compilationFailed: boolean;
  executeMethodMissing: boolean;
  executeMethodException: boolean;
  licensingFailed: boolean;
  fatalExit: boolean;
}

const UNKNOWN_FAILURE_REASON = "Unity 执行失败，未识别到具体原因";

export async function diagnoseUnityFailure(logPath: string): Promise<UnityFailureDiagnosis> {
  const state = createState();

  try {
    const input = createReadStream(logPath, { encoding: "utf8" });
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) inspectLine(state, line);
    return { reason: formatReason(state) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      reason: UNKNOWN_FAILURE_REASON,
      warning: `诊断日志读取失败: ${message}`,
    };
  }
}

export function analyzeUnityLog(content: string): string {
  const state = createState();
  for (const line of content.split(/\r?\n/)) inspectLine(state, line);
  return formatReason(state);
}

function createState(): DiagnosticState {
  return {
    projectAlreadyOpen: false,
    compilationFailed: false,
    executeMethodMissing: false,
    executeMethodException: false,
    licensingFailed: false,
    fatalExit: false,
  };
}

function inspectLine(state: DiagnosticState, line: string): void {
  if (/another Unity instance is running with this project open|Multiple Unity instances cannot open the same project/i.test(line)) {
    state.projectAlreadyOpen = true;
  }

  const projectMatch = line.match(/^\s*Project:\s*(.+?)\s*$/i);
  if (state.projectAlreadyOpen && projectMatch) state.projectPath = projectMatch[1];

  if (/Scripts have compiler errors|Compilation failed|Compiler errors? detected/i.test(line)) {
    state.compilationFailed = true;
  }

  if (/executeMethod.*(?:could not be found|not found)|(?:class|method).*executeMethod.*(?:could not be found|not found)/i.test(line)) {
    state.executeMethodMissing = true;
  }
  if (/Exception while executing method|executeMethod.*(?:threw|exception)/i.test(line)) {
    state.executeMethodException = true;
  }

  if (/Successfully (?:updated license|resolved entitlements)|License is active/i.test(line)) {
    state.licensingFailed = false;
  } else if (/No valid Unity Editor license found|Failed to (?:activate|update).*license|License.*(?:activation|validation).*failed/i.test(line)) {
    state.licensingFailed = true;
  }

  if (/Fatal Error!|Crash!!!|A crash has been intercepted/i.test(line)) {
    state.fatalExit = true;
  }
}

function formatReason(state: DiagnosticState): string {
  if (state.projectAlreadyOpen) {
    return state.projectPath
      ? `Unity 项目已被另一个实例打开: ${state.projectPath}`
      : "Unity 项目已被另一个实例打开";
  }
  if (state.compilationFailed) return "Unity 项目脚本编译失败";
  if (state.executeMethodMissing) return "Unity executeMethod 指定的类或方法不存在";
  if (state.executeMethodException) return "Unity executeMethod 执行时发生异常";
  if (state.licensingFailed) return "Unity 授权失败";
  if (state.fatalExit) return "Unity 发生崩溃或致命退出";
  return UNKNOWN_FAILURE_REASON;
}
