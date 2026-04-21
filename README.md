# Nianxie UnityWebGLTmpl Branch

这个分支只保留 Unity WebGL 模版能力，目标是：

- 开发者本地直接可运行
- 通过 Unity Package Manager 安装插件

## 文档入口

- 完整 Unity 手册：`unity/UnityWebGLTmpl/README.md`

## UPM 包信息

- Package Name: `com.nianxie.webgl-template`
- Package Path: `unity/UnityWebGLTmpl`

## 安装方式

### 1) 本地路径安装（推荐开发态）

在 Unity 项目 `Packages/manifest.json` 添加：

```json
{
  "dependencies": {
    "com.nianxie.webgl-template": "file:../path/to/nianxie_web_sdk/unity/UnityWebGLTmpl"
  }
}
```

### 2) Git URL 安装（推荐团队协作）

```json
{
  "dependencies": {
    "com.nianxie.webgl-template": "https://github.com/nianxie/nianxie_web_sdk.git?path=/unity/UnityWebGLTmpl#UnityWebGLTmpl"
  }
}
```

安装后在 Unity 菜单执行：

- `Tools/Nianxie/Install WebGL Template To Assets`

然后设置：

- `Project Settings -> Player -> WebGL -> Resolution and Presentation -> WebGL Template`
- 选择 `NianxieTemplate`

## 保留内容

- `unity/UnityWebGLTmpl`（UPM 包 + Unity 模版资产）
- `tools/*`（导出产物校验与模拟）
- `error-codes.json`（统一错误码）
# Nianxie UnityWebGLTmpl 分支说明

本分支仅保留 **Unity WebGL 模版接入** 所需内容，不再维护 npm 包发布形态。

## 文档入口

- Unity 完整文档：`unity/UnityWebGLTmpl/README.md`

## 当前分支保留内容

- Unity 模版资产：`unity/UnityWebGLTmpl/Assets/*`
- 运行校验工具：`tools/*`
- 错误码字典：`error-codes.json`

## 当前分支已移除内容

- npm 发布相关文件（`package.json`、`index.d.ts`、根目录 SDK 构建产物）
- 通用 Web 包接入文档

如果你在做 Unity 接入，请直接阅读 `unity/UnityWebGLTmpl/README.md` 并按其中流程执行。
# Nianxie WebSDK 使用说明（Web 通用版）

这份文档按 **4 个固定部分**组织，目标是让人和 AI 都能快速执行：

1. 信号说明（协议与时序）
2. 作品制作（可上传 + 可运行）
3. 模版制作（可上传 + 可配置 + 可运行）
4. 提供的指令（命令与产物）

---

## 第一部分：信号说明

### 1) 标准四段式时序（必须完整闭环）

1. Host -> Web: `window.OnMiniInit(payload)`，`eventId = interaction_init`
2. Web -> Host: `NianxieMiniReady`，通常 `eventId = interaction_ready`
3. Host -> Web: `window.OnMiniStart(payload)`，`eventId = interaction_start`
4. Web -> Host: `NianxieMiniEnd`，通常 `eventId = interaction_end`

只要是接入 Nianxie 宿主，必须走完 `init -> ready -> start -> end`。

### 2) payload 规则（强约束）

- `sessionId / itemId / title` 由 SDK 自动维护，不要手写或覆盖。
- 业务数据统一放 `extras`。
- 模版模式读取优先级：`payload.extras.craft` > `payload.craft`（仅兼容兜底）。

### 3) 最小接入示例（原生 JS）

```html
<script src="./nianxie-interaction-sdk.js"></script>
<script>
  const sdk = NianxieInteractionSDK.createNianxieInteractionSDK({
    source: "webview",
    defaultTimeoutMs: 10000,
  });

  const offInit = sdk.onInit(async (payload) => {
    const craft = payload?.extras?.craft ?? payload?.craft;
    // 这里完成资源准备、数据校验等
    await sdk.sendReady({ extras: { stage: "assets-loaded" } });
  });

  const offStart = sdk.onStart((_payload) => {
    // 收到 start 后进入互动态
  });

  async function finish() {
    await sdk.sendEnd({ extras: { result: "completed" } });
  }

  // 销毁时清理
  // offInit(); offStart(); sdk.destroy();
</script>
```

---

## 第二部分：作品制作（Playable Work）

适用场景：只做单个可运行作品，不需要外部 craft 驱动。

### 目标

- 可上传
- 可运行
- 可结束（能发送 `end`）

### 规则

- 允许使用本地固定 JSON。
- 本地资源使用相对路径（如 `./assets/...`）。
- 入口必须是 `dist/index.html`。
- 不允许 dev runtime 标记（如 `@vite/client`、`import.meta.hot`）。

### 推荐构建实践（Vite）

- `base: "./"`。
- 推荐 `vite-plugin-singlefile`（非强制）。
- SDK 推荐在业务代码 `import`，或以相对路径脚本引入。

### 自检清单

- [ ] 能收到 `OnMiniInit`
- [ ] 会发送 `sendReady`
- [ ] 能收到 `OnMiniStart`
- [ ] 会发送 `sendEnd`
- [ ] `9:16` 竖屏容器显示正常
- [ ] 失败有可见提示（不仅 console）

---

## 第三部分：模版制作（Configurable Template）

适用场景：作品由外部 craft JSON 驱动，可复用为模版。

### 目标

- 可上传
- 可配置（消费外部 craft）
- 可运行

### 数据规则

- 主通道：`payload.extras.craft`
- 兼容兜底：`payload.craft`
- 不要把核心内容写死在包内

### 建议能力

- 对 craft 做解析与校验（建议配套 schema）
- 至少一个可达结束路径
- 提供可观测状态（init/start/ready/end）

### 资源管理建议

- 静态资源走构建依赖图（如静态 import + URL 映射）
- 禁止运行时拼接本地资源路径
- 允许线上静态资源（如 OSS），但要有降级策略

---

## 第四部分：提供的指令

### 1) 安装 SDK

当前默认发布在 GitHub Packages：

```bash
npm install @nianxie/nianxie-interaction-sdk --@nianxie:registry=https://npm.pkg.github.com
```

固定版本：

```bash
npm install @nianxie/nianxie-interaction-sdk@0.5.0 --@nianxie:registry=https://npm.pkg.github.com
```

### 2) 推荐在模板工程声明脚本

```json
{
  "scripts": {
    "nx:package": "npx nianxie-gate package",
    "nx:verify:runtime": "npx nianxie-gate verify-runtime",
    "nx:preflight": "npx nianxie-gate preflight",
    "nx:submit:prepare": "npx nianxie-gate submit-prepare",
    "nx:simulate:host": "npx nianxie-gate simulate-host"
  }
}
```

### 3) 指令说明

- `npm run nx:package`
  - 安装依赖 + 构建 + 产出 `dist/` 与 `dist.zip`
  - 产出 `reports/package-report.json`
  - warning 不阻断

- `npm run nx:verify:runtime`
  - 校验协议闭环、资源可达、路径兼容
  - 产出 `reports/runtime-verify.json`
  - blocking 将返回非 0

- `npm run nx:preflight`
  - 顺序执行 `nx:package -> nx:verify:runtime`
  - 用于提交前一键闸门

- `npm run nx:submit:prepare`
  - 在 preflight 通过后输出最终上传包路径与摘要
  - 产出 `reports/submit-prepare.json`（含 sha256）

- `npm run nx:simulate:host`
  - 本地模拟宿主最小流程并生成报告
  - 产出 `reports/local-host-simulator.json`

### 4) 交付最低标准（发布前）

- `runtime-verify.json` 中 `ok=true` 且 `blockingCount=0`
- 已生成 `dist.zip`
- 已生成 `submit-prepare.json`

---

## SDK API 速查

- `createNianxieInteractionSDK(options)`
- `sdk.onInit(callback)`
- `sdk.onStart(callback)`
- `sdk.sendReady({ extras }, { timeoutMs })`
- `sdk.sendEnd({ extras }, { timeoutMs })`
- `sdk.request(name, { extras }, { timeoutMs })`
- `sdk.waitForBridge(...)`
- `sdk.waitForContext(...)`
- `sdk.getDiagnosticsEvents()`
- `sdk.getDiagnosticsState()`
- `sdk.destroy()`

类型定义见 `index.d.ts`。
