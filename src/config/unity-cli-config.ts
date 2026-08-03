export interface UnityCliConfig {
  unityExe: string;
  projectPath: string;
  runMethod: string;
  unityLog: string;
  quitOnComplete: boolean;
  timeoutSeconds?: number;
}
