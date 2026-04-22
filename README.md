# Nianxie Unity WebGL UPM 插件

该包面向 **UPM 开箱即用**：模板、JS bridge、C# bridge 都放在包内统一维护。

## 1) UPM 接入

在 Unity 项目 `Packages/manifest.json` 添加依赖：

```json
{
  "dependencies": {
    "com.nianxie.webgl-template": "https://github.com/nianxie/nianxie_web_sdk.git#UnityWebGLTmpl"
  }
}
```

## 2) 一次性初始化

在 Unity 菜单执行：

- `Tools/Nianxie/Install WebGL Template To Assets`
- `Tools/Nianxie/Init NianxieBridge In Current Scene`

然后设置：

- `Project Settings -> Player -> WebGL -> Resolution and Presentation -> WebGL Template`
- 选择 `NianxieTemplate`

> `NianxieBridge` 也支持运行时自动创建；菜单初始化用于显式可视化配置和手动调参。

## 3) 生命周期（内置默认行为）

UPM Runtime 默认实现以下流程：

1. Host -> WebGL：`window.OnMiniInit(payload)`
2. Unity 侧执行预启动逻辑（可选调用 `StartGameDirect`）并暂停（`Time.timeScale = 0`）
3. WebGL -> Host：`NianxieMiniReady`
4. Host -> WebGL：`window.OnMiniStart(payload)`
5. Unity 恢复运行（`Time.timeScale = 1`）
6. 游戏结束后主动发 `NianxieMiniEnd`

核心脚本：`Runtime/Scripts/NianxieBridge.cs`

## 4) 顶部安全区 + 150 偏移

`NianxieBridge` 内置顶部 UI 下压逻辑：

- 偏移量 = `设备顶部安全区高度 + extraTopOffsetPx`
- 默认 `extraTopOffsetPx = 150`
- 默认通过反射兼容 `OctoberStudio.GameScreenBehavior.topUI`

如果项目 UI 结构不同，可关闭默认逻辑并在业务侧自行处理。

## 5) WebGL 模板规范

`WebGLTemplates/NianxieTemplate/index.html` 使用 Unity 官方模板变量（`{{{ ... }}}`）：

- `{{{ LOADER_FILENAME }}}`
- `{{{ DATA_FILENAME }}}`
- `{{{ FRAMEWORK_FILENAME }}}`
- `{{{ CODE_FILENAME }}}`

避免 `%UNITY_WEBGL_*%` 未替换导致的导出事故。

## 6) 打包前最小检查

- ZIP 根目录包含 `index.html` 与 `Build/`
- `index.html` 内使用相对路径（`./Build/...`）
- 关键文件齐全：`*.loader.js / *.framework.js / *.data / *.wasm`
- 协议完整：`init -> ready -> start -> end`
