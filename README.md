# Nianxie Unity WebGL UPM 插件

这个分支已按 **UPM 插件仓库** 组织（包内结构：`Runtime/`、`WebGLTemplates/`）。  
通过 UPM 拉取后，资源直接从 `Packages` 使用，不再执行拷贝到 `Assets` 的安装动作。

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

## 2) 手动配置（必须）

先在 Unity 菜单执行（一次即可）：

- `Tools/Nianxie/Install WebGL Template To Assets`

然后在 Unity 中设置：

- `Project Settings -> Player -> WebGL -> Resolution and Presentation -> WebGL Template`
- 选择：`NianxieTemplate`

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
