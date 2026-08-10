
/**
 * Unity CLI 配置接口
 * param unityExe Unity 可执行文件路径
 * param projectPath Unity 项目路径
 * param runMethod Unity 执行方法
 * param unityLog Unity 日志文件路径
 * param quit 是否在完成后退出 Unity
 * param noGraphics 是否以无图形模式运行 Unity
 * param timeoutSeconds Unity 执行超时时间（秒），可选
 */
export interface UnityCliConfig {
  unityExe: string;
  projectPath: string;
  runMethod: string;
  unityLog: string;
  quit: boolean;
  noGraphics: boolean;
  timeoutSeconds?: number;
}
