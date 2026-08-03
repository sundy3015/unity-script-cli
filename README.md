# Unity Script CLI

使用 Node.js + TypeScript 从命令行启动 Unity Editor，并执行 Unity 工程中的静态方法。适合自动化验证、资源检查、批量处理和 CI 任务。

## 功能

- 从固定配置文件读取 Unity、工程、执行方法和日志路径。
- 启动前校验 Unity 程序及 Unity 工程目录。
- 使用 Unity `-batchmode` 和 `-executeMethod` 执行静态方法。
- Unity 直接写入日志文件，CLI 将新增日志实时同步到终端。
- 任务结束后显示成功或失败、退出码和总耗时。

## 安装

克隆工程并安装依赖：

```powershell
git clone https://github.com/sundy3015/unity-script-cli.git
Set-Location unity-script-cli
npm install
```

## 配置

在项目根目录创建 `unity-cli.config.json`：

```json
{
  "unityExe": "C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.0f1\\Editor\\Unity.exe",
  "projectPath": "E:\\path\\to\\unity-project",
  "runMethod": "Tools.Verify.Run",
  "unityLog": "logs\\unity.log",
  "quitOnComplete": true
}
```

| 配置项 | 类型 | 说明 |
| --- | --- | --- |
| `unityExe` | `string` | Unity 可执行文件的路径。 |
| `projectPath` | `string` | 包含 `Assets` 和 `ProjectSettings` 的 Unity 工程路径。 |
| `runMethod` | `string` | 传给 Unity `-executeMethod` 的静态方法全名。 |
| `unityLog` | `string` | Unity 日志文件路径；相对路径以配置文件目录为基准。 |
| `quitOnComplete` | `boolean` | 方法执行完成后是否通过 `-quit` 关闭 Unity。 |
| `timeoutSeconds` | `number` | 可选；Unity 最大运行秒数，范围为 `(0, 86400]`。未配置时不限制运行时间。 |

`unity-cli.config.json` 已加入 `.gitignore`，本机路径不会被提交。

## Unity 方法

执行方法需要位于 Unity Editor 程序集中，并且必须是可访问的静态方法。例如在 Unity 工程的 `Assets/Editor/Tools/Verify.cs` 中添加：

```csharp
namespace Tools
{
    public static class Verify
    {
        public static void Run()
        {
            UnityEngine.Debug.Log("验证完成");
        }
    }
}
```

对应配置为：

```json
"runMethod": "Tools.Verify.Run"
```

## 运行

```powershell
npm run unity
```

实际启动参数类似：

```text
Unity.exe -batchmode -projectPath <projectPath> -executeMethod <runMethod> -logFile <unityLog> -quit
```

Unity 直接将日志写入 `unityLog`，CLI 实时跟踪该文件并显示新增内容。每次运行会覆盖原日志文件。

任务结束后会输出状态：

```text
[Unity CLI] 任务成功，退出码: 0，耗时: 12.4 秒
```

非零 Unity 退出码会作为 CLI 的退出码。当 `quitOnComplete` 为 `false` 时，需要关闭 Unity 进程后才会显示最终状态。

仅调用 `Debug.LogError` 不保证 Unity 返回非零退出码。自动化方法失败时应抛出未处理异常，或显式调用 `UnityEditor.EditorApplication.Exit(1)`。

## 项目结构

```text
src/
├── index.ts                         # CLI 入口
├── cli/
│   ├── cli-application.ts           # 运行流程编排
│   └── status-formatter.ts          # 状态和耗时格式化
├── config/
│   ├── config-loader.ts             # 配置读取与字段校验
│   └── unity-cli-config.ts          # 配置类型
├── logging/
│   └── log-follower.ts              # 日志文件实时跟踪
└── unity/
    ├── unity-cli-runner.ts          # Unity 参数和进程执行
    └── unity-project-validator.ts   # Unity 工程路径校验
```

## 开发检查

```powershell
npm run check
npm test
```

测试不会实际启动 Unity。

## 常见问题

- **找不到配置文件**：确认项目根目录存在 `unity-cli.config.json`。
- **Unity 工程校验失败**：确认 `projectPath` 下包含 `Assets` 和 `ProjectSettings`。
- **方法无法执行**：确认脚本位于 Editor 程序集、方法为静态方法，并使用完整的命名空间、类名和方法名。
- **任务一直未结束**：当 `quitOnComplete` 为 `false` 时，CLI 会持续等待 Unity 进程关闭。
- **日志报错但任务显示成功**：确保失败路径抛出异常或调用 `EditorApplication.Exit(1)`。
