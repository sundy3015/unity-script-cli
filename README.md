# Unity Script CLI

使用 Node.js + TypeScript 从命令行启动 Unity Editor，并调用配置中指定的静态方法。适合快速验证、资源检查和自动化任务。

## 安装与配置

```powershell
npm install
Copy-Item unity-cli.config.example.json unity-cli.config.json
```

编辑项目根目录的 `unity-cli.config.json`：

```json
{
  "unityExe": "C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.0f1\\Editor\\Unity.exe",
  "projectPath": "E:\\path\\to\\unity-project",
  "runMethod": "Tools.Verify.Run",
  "unityLog": "logs\\unity.log",
  "quitOnComplete": true
}
```

- `unityExe`：Unity 可执行文件路径。
- `projectPath`：包含 `Assets` 和 `ProjectSettings` 的 Unity 工程路径。
- `runMethod`：传给 Unity `-executeMethod` 的静态方法全名。
- `unityLog`：Unity 日志文件路径；相对路径以配置文件所在目录为基准。
- `quitOnComplete`：方法执行完成后是否通过 `-quit` 退出 Unity。

`unity-cli.config.json` 已加入 `.gitignore`，不会提交本机路径配置。

## 运行

```powershell
npm run unity
```

工具会校验 Unity 和工程路径，随后以 `-batchmode` 启动 Unity 并执行配置的方法。Unity 会直接将完整日志写入 `unityLog` 指定的文件，CLI 同时跟踪该文件并将新增内容实时显示在终端。每次运行会覆盖原日志文件。

任务结束后，终端会显示成功或失败、Unity 退出码和总耗时。Unity 进程的退出码会作为命令的退出码：

```text
[Unity CLI] 任务成功，退出码: 0，耗时: 12.4 秒
```

当 `quitOnComplete` 为 `false` 时，需要等待 Unity 进程关闭后才会显示最终状态。

## 开发检查

```powershell
npm run check
npm test
```
