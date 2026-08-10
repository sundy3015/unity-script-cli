# Unity Script CLI

一个使用 Node.js + TypeScript 编写的轻量级 Unity 命令行启动器。它会以批处理模式启动 Unity Editor，并通过 `-executeMethod` 调用 Unity 项目中的 C# 静态方法。

适用于以下场景：

- 在 CI/CD 中执行 Unity 构建或检查
- 批量处理和验证项目资源
- 自动检查 Scene、Prefab 或配置
- 从外部脚本调用 Unity Editor 工具
- 快速验证无需手动操作编辑器的自动化任务

## 工作方式

工具会依次完成以下操作：

1. 读取 `unity-cli.config.json`。
2. 检查 Unity 可执行文件及 Unity 项目目录是否存在。
3. 清空本次运行使用的日志文件。
4. 使用 `-batchmode` 启动 Unity，并执行配置的静态方法。
5. 实时将 Unity 日志同步到当前终端。
6. Unity 退出后输出运行结果、退出码和总耗时。

Unity 进程的退出码也会作为 CLI 的退出码，便于在自动化脚本或 CI 中判断任务是否成功。

## 环境要求

- Node.js 18 或更高版本
- npm
- 已安装的 Unity Editor
- 一个包含 `Assets` 和 `ProjectSettings` 目录的 Unity 项目

## 安装

```powershell
npm install
```

## 配置

在本仓库根目录创建 `unity-cli.config.json`：

```json
{
  "unityExe": "C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.0f1\\Editor\\Unity.exe",
  "projectPath": "E:\\path\\to\\unity-project",
  "runMethod": "Tools.Verify.Run",
  "unityLog": "logs\\unity.log",
  "quitOnComplete": true
}
```

配置项说明：

| 配置项 | 类型 | 说明 |
| --- | --- | --- |
| `unityExe` | `string` | Unity Editor 可执行文件的路径。 |
| `projectPath` | `string` | Unity 项目路径，必须包含 `Assets` 和 `ProjectSettings`。 |
| `runMethod` | `string` | 传给 Unity `-executeMethod` 的静态方法全名。 |
| `unityLog` | `string` | Unity 日志文件路径；相对路径以仓库根目录为基准。 |
| `quitOnComplete` | `boolean` | 是否添加 `-quit`，让 Unity 在方法执行后退出。 |

`unity-cli.config.json` 已加入 `.gitignore`，其中的本机路径不会被提交。

## Unity 方法示例

`runMethod` 指向的方法需要是可由 Unity `-executeMethod` 调用的静态方法。Editor 工具建议放在 Unity 项目的 `Editor` 目录中：

```csharp
using UnityEditor;
using UnityEngine;

namespace Tools
{
    public static class Verify
    {
        public static void Run()
        {
            Debug.Log("开始执行项目检查");

            // 在这里执行资源检查、构建或其他自动化任务。

            Debug.Log("项目检查完成");
        }
    }
}
```

对应配置为：

```json
{
  "runMethod": "Tools.Verify.Run"
}
```

实际配置文件仍需包含其他必填配置项。

## 运行

```powershell
npm run unity
```

工具实际启动 Unity 时使用的参数大致如下：

```text
Unity.exe -batchmode \
  -projectPath E:\path\to\unity-project \
  -executeMethod Tools.Verify.Run \
  -logFile logs\unity.log \
  -quit
```

运行期间，Unity 会将完整日志写入 `unityLog` 指定的文件，CLI 会轮询该文件并把新增内容实时显示在终端。每次运行都会覆盖原日志文件。

任务结束后会显示类似以下结果：

```text
[Unity CLI] 任务成功，退出码: 0，耗时: 12.4 秒
```

如果 Unity 返回非零退出码，CLI 也会以相同的非零退出码结束。

## `quitOnComplete` 的行为

- 设置为 `true` 时，启动参数中会包含 `-quit`，适合一次性自动化任务和 CI。
- 设置为 `false` 时，Unity 不会因该参数自动退出；CLI 会持续等待 Unity 进程关闭，之后才输出最终结果。

## 开发检查

运行 TypeScript 类型检查：

```powershell
npm run check
```

运行测试：

```powershell
npm test
```

测试覆盖配置解析、Unity 启动参数、日志跟踪以及结果格式化。

## 注意事项

- 同一个 Unity 项目通常不能同时被多个 Unity Editor 进程打开。
- `runMethod` 不存在、脚本编译失败或项目资源导入失败时，请查看配置的 Unity 日志文件。
- 日志文件所在目录会自动创建，但已有日志内容会在启动前清空。
- 如果自动化方法需要明确表示失败，应让 Unity 以非零状态退出，例如调用 `EditorApplication.Exit(code)`。
