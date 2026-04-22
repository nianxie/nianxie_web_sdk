# Nianxie Unity WebGL UPM 插件

这个分支已按 **UPM 插件仓库** 组织。  
通过 UPM 拉取后，Unity 会自动安装模板文件到 `Assets/`，可直接使用。

## 1) UPM 接入方式

在 Unity 项目 `Packages/manifest.json` 添加：

```json
{
  "dependencies": {
    "com.nianxie.webgl-template": "https://github.com/nianxie/nianxie_web_sdk.git#UnityWebGLTmpl"
  }
}
```

说明：

- `#UnityWebGLTmpl`：指定分支

如果你使用的是其他仓库地址，把 URL 替换成你的实际地址即可。

## 2) 拉取后会自动做什么

- 自动拷贝到项目：
  - `Assets/Scripts/NianxieBridge.cs`
  - `Assets/Plugins/WebGL/nianxie_bridge.jslib`
  - `Assets/WebGLTemplates/NianxieTemplate`
- 自动尝试设置 `PlayerSettings.WebGL.template = NianxieTemplate`

如需手动重装，可在 Unity 菜单执行：

- `Tools/Nianxie/Install WebGL Template To Assets`
- `Tools/Nianxie/Reinstall WebGL Template To Assets (Force)`

## 3) 必须的信号时序

> ⚠️ 必须完整走完：`init -> ready -> start -> end`

1. Host -> WebGL：`window.OnMiniInit(payload)`
2. WebGL -> Host：`NianxieMiniReady`
3. Host -> WebGL：`window.OnMiniStart(payload)`
4. WebGL -> Host：`NianxieMiniEnd`

缺少任意一步都视为协议不完整。

## 4) 提交前最小检查

- ZIP 根目录有 `index.html` 和 `Build/`
- 使用相对路径（`./Build/...`），不要绝对路径
- 关键文件齐全：`*.loader.js / *.framework.js / *.data / *.wasm`
- 运行流程能走完 `init -> ready -> start -> end`
