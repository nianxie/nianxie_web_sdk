# WebSDK 模板制作与接入总规范

本文档是唯一权威规范，面向：

- AI 代理（按规则自动生成小游戏模板）
- 开发者（手工实现可上传、可运行的模板）

目标是保证产物可以：

1. 在开发者平台上传并通过试运行
2. 在宿主侧完成一次完整握手与运行：`init -> ready -> start -> end`
3. 作为“可上传 + 可配置 + 可运行”的模板被复用

发布前测试口径：

- 用户侧发布前仅通过开发者平台进行测试与验收。
- 当作品遵守本规范并在开发者平台运行通过时，Flutter 侧应可直接使用。

## 目录导航

- [开发阶段强制流程（必须执行）](#开发阶段强制流程必须执行)
- [获取 WebSDK](#获取-websdk)
- [[0] 产物类型（先选模式）](#0-产物类型先选模式)
- [[1] 必须遵守的协议与时序](#1-必须遵守的协议与时序)
- [[2] 模板引擎最低能力](#2-模板引擎最低能力)
- [[3] 画面与交付约束](#3-画面与交付约束)
- [[4] 实现模板（推荐写法）](#4-实现模板推荐写法)
- [[5] 上传与运行对齐要求](#5-上传与运行对齐要求)
- [[6] 验收清单（提交前必须自检）](#6-验收清单提交前必须自检)
- [[7] 常见问题排查](#7-常见问题排查)
- [[8] SDK API 速查](#8-sdk-api-速查)
- [[9] 资源依赖、加载与开发者平台发布说明](#9-资源依赖加载与开发者平台发布说明)
- [[10] 本地宿主模拟器（与平台错误对齐）](#10-本地宿主模拟器与平台错误对齐)
- [[11] 统一错误码字典（平台/脚本/AI 通用）](#11-统一错误码字典平台脚本ai-通用)
- [[12] 命令契约（AI 与开发者共用）](#12-命令契约ai-与开发者共用)
- [[13] 模板工程自检闸门（本地/CI）](#13-模板工程自检闸门本地ci)
- [[14] 人工/AI 按报告修复的标准闭环](#14-人工ai-按报告修复的标准闭环)

## 建议阅读顺序

1. 首次接入：先看 [获取 WebSDK](#获取-websdk) + [[0]](#0-产物类型先选模式) + [[1]](#1-必须遵守的协议与时序) + [[3]](#3-画面与交付约束) + [[4]](#4-实现模板推荐写法)。
2. 发布前自检：看 [[6]](#6-验收清单提交前必须自检) + [[9]](#9-资源依赖加载与开发者平台发布说明) + [[12]](#12-命令契约ai-与开发者共用) + [[13]](#13-模板工程自检闸门本地ci)。
3. 报错排查：看 [[7]](#7-常见问题排查) + [[10]](#10-本地宿主模拟器与平台错误对齐) + [[11]](#11-统一错误码字典平台脚本ai-通用) + [[14]](#14-人工ai-按报告修复的标准闭环)。

## 开发阶段强制流程（必须执行）

任何模板（AI 生成或人工编写）提交前必须按以下顺序执行，且只认 `dist` 产物，不认 `src`：

1. `npm run nx:package`
   - 编排安装依赖、构建、产出 `dist/` 与 `dist.zip`
   - 生成 `reports/package-report.json`
   - 该阶段仅输出 warning，不因 warning 阻断
2. `npm run nx:verify:runtime`
   - 基于 `dist` 与 `dist.zip` 校验协议闭环、资源可达、路径/运行时兼容
   - 生成 `reports/runtime-verify.json`
   - 若存在阻断项，退出码必须非 0
3. `npm run nx:submit:prepare`
   - 仅在 preflight 通过后输出“最终可上传包路径 + 摘要”

上传交互模式（当前默认）：

- 本地浏览器负责：解压、校验、预览、产包（`dist` / `dist.zip`）。
- 浏览器直连服务端 API，并直传对象存储（如 OSS）。
- 不经过开发者本机做代理中转；后续如需本机代理可再作为可选通道引入。

如果是 AI 自动修复流程，AI 必须遵守同一顺序：先 package，再 verify，再 submit prepare；不得跳过阻断校验直接提交。

### 失败分级（统一口径）

- `warning`（不阻断）：
  - 可能的路径规范风险（但当前构建仍可运行）
  - 资源策略建议项（如线上静态资源缺少降级提示）
  - 协议可观测性建议项（日志/诊断开关缺失）
- `blocking`（阻断提交）：
  - 缺失 `dist/index.html`
  - 缺失 `nianxie-interaction-sdk.js` 引用
  - 绝对路径入口依赖（`/assets/...`）
  - 资源引用缺失（构建后文件不可达）
  - 时序闭环缺失（未覆盖 `onInit/onStart/sendReady/sendEnd`）
  - 检测到 dev runtime 标记（如 `@vite/client`、`import.meta.hot`、`localhost`）

---

## 获取 WebSDK

优先使用 npm 安装（GitHub Packages）：

```bash
npm install @nianxie/nianxie-interaction-sdk --@nianxie:registry=https://npm.pkg.github.com
```

同一个 npm 包同时提供：

- 运行时 SDK：`nianxie-interaction-sdk.js`
- 开发/CI 闸门 CLI：`nianxie-gate`

约束说明：

- 模板运行时代码只应依赖 `nianxie-interaction-sdk.js`。
- `nianxie-gate` 与 `tools/*` 仅用于本地开发和 CI 校验，不应在业务运行时被 import。

如果需要固定版本，可指定版本号：

```bash
npm install @nianxie/nianxie-interaction-sdk@0.1.0 --registry=https://npm.pkg.github.com
```

如果你的模板工程是直接内置 SDK 文件，也可使用仓库内的 `websdk/nianxie-interaction-sdk.js`，并在页面中以相对路径引入：

```html
<script src="./nianxie-interaction-sdk.js"></script>
```

---

## 0. 产物类型（先选模式）

本平台支持两种交付模式，二选一或同时支持：

### A) 直接作品模式（Playable Work）

- 作品使用**本地固定 JSON**（随包发布）
- 作品使用**本地相对路径资源**（如 `./assets/...`）
- 运行时可以不解析 `payload.extras.craft`
- 仍必须遵守握手时序：`init -> ready -> start -> end`

适用：你只需要“可上传 + 可运行”的单个作品，不需要 AIGC 生成注入。

### B) craft 驱动模板模式（Configurable Template）

- 作品必须消费运行时传入的 `payload.extras.craft`
- 通过外部 JSON 驱动流程（可做 schema 校验）
- 目标是“可上传 + 可配置 + 可运行”

适用：你希望作品可被外部 craft 数据驱动，不把内容写死在包内。

---

## 1. 必须遵守的协议与时序

### 1.1 四段式生命周期（强约束）

1. Flutter -> Web：`window.OnMiniInit(payload)`（`eventId: interaction_init`）
2. Web -> Flutter：`NianxieMiniReady`（通常 `eventId: interaction_ready`）
3. Flutter -> Web：`window.OnMiniStart(payload)`（`eventId: interaction_start`）
4. Web -> Flutter：`NianxieMiniEnd`（通常 `eventId: interaction_end`）

任何模板都必须走完这个闭环，不能只跑本地逻辑不回传信号。

### 1.2 payload 上下文规则（强约束）

- `sessionId/itemId/title` 由 SDK 与宿主协同维护。
- 模板逻辑**不要手写/硬编码**这三个字段。
- 业务数据一律放 `extras`。

### 1.3 craft 输入规则（强约束）

- craft 驱动模板模式：运行数据优先从 `payload.extras.craft` 读取。
- `payload.craft` 仅可作为兼容兜底，不应作为主通道。
- 直接作品模式：允许忽略 craft，直接加载本地固定 JSON。
- 无论哪种模式，数据加载失败都要可见反馈（不仅 console）。

---

## 2. 模板引擎最低能力

模板本质是“解释器/执行器”：

- 输入：外部 JSON（craft）
- 过程：解析 + 校验 + 转换为内部状态
- 输出：可交互的游戏流程与画面

最低要求：

- 直接作品模式：允许使用本地固定 JSON
- craft 驱动模板模式：运行内容由外部 craft 驱动，不允许把故事/关卡完全写死
- craft 驱动模板模式建议具备 schema（Zod + JSON Schema 导出）
- 有明确开始和结束条件，且开始路径可达至少一个结束节点

---

## 3. 画面与交付约束

### 3.1 画面比例

- 主画面必须兼容 `9:16` 纵向容器
- 页面可自适应，但视觉比例不能跑偏

### 3.2 打包交付

资源依赖与发布细则见 `第9章`（含静态 import、映射、禁止清单与上传前自检）。

- `npm run build` 后产物可直接交付
- 运行核心 JS 不依赖远端 CDN 才能运行（离线/内网也可启动）
- 必须通过打包插件将运行所需 JS 合并到交付产物（推荐 `vite-plugin-singlefile`）
- 交付入口必须为 `dist/index.html`
- 代码入口与本地资源引用优先使用相对路径（如 `./assets/...`、`./nianxie-interaction-sdk.js`）
- 允许使用线上静态资源（如 OSS 图片/音频），但需保证资源稳定可访问并有失败降级

singlefile 模式建议（强烈推荐）：

- `vite.config.ts` 使用 `base: "./"` 并启用 `vite-plugin-singlefile`。
- SDK 优先在业务代码中通过 npm import（例如 `import NianxieInteractionSDK from "@nianxie/nianxie-interaction-sdk"`）。
- 不建议在 `index.html` 写 `./node_modules/...` 脚本路径；构建产物中该路径通常无效。
- 若必须保留独立 SDK 文件，请通过 `public/nianxie-interaction-sdk.js` 输出并以 `./nianxie-interaction-sdk.js` 相对路径引用。
- 绝对路径（如 `/assets/...`、`url(/assets/...)`）视为阻断项；上传 OSS 场景必须改为相对路径。

---

## 4. 实现模板（推荐写法）

### 4.1 原生 JS 最小闭环

```html
<script src="./nianxie-interaction-sdk.js"></script>
<script>
  const sdk = NianxieInteractionSDK.createNianxieInteractionSDK({
    source: "webview",
    defaultTimeoutMs: 10000,
  });

  const offInit = sdk.onInit(async (payload) => {
    const craft = payload?.extras?.craft ?? payload?.craft;
    // 模式 1：craft 驱动模板（有 craft）
    // 模式 2：直接作品（无 craft，改读本地 JSON）
    // const data = craft ?? localJson;
    // if (!data) { document.body.innerText = "数据缺失，无法运行"; return; }

    // 1) 解析/校验数据 2) 加载资源 3) 准备完成后发送 ready
    await sdk.sendReady({ extras: { stage: "assets-loaded" } });
  });

  const offStart = sdk.onStart((_payload) => {
    // 收到 start 才真正开始互动
  });

  async function finishInteraction() {
    await sdk.sendEnd({ extras: { result: "completed" } });
  }

  // 页面销毁时释放
  // offInit(); offStart(); sdk.destroy();
</script>
```

### 4.2 React 最小闭环

```tsx
useEffect(() => {
  const offInit = sdk.onInit(async (payload) => {
    const craft = payload?.extras?.craft ?? payload?.craft;
    if (!craft) throw new Error("craft missing");
    await sdk.sendReady({ extras: { stage: "assets-loaded" } });
  });

  const offStart = sdk.onStart(() => {
    // start 后进入可交互态
  });

  return () => {
    offInit();
    offStart();
    sdk.destroy();
  };
}, [sdk]);
```

---

## 5. 上传与运行对齐要求

### 5.1 直接作品模式（可上传 + 可运行）

需满足：

- 作品数据来自本地固定 JSON（随包构建）
- 核心运行资源可本地打包；允许业务静态资源走线上地址（如 OSS）
- 在宿主环境完成 `init -> ready -> start -> end`
- 能稳定结束并发出 `end`

### 5.2 craft 驱动模板模式（可上传 + 可配置 + 可运行）

需满足：

- mini 本身可在开发者平台试运行通过
- 模板能消费外部传入的 craft JSON（`payload.extras.craft`）
- 宿主握手日志应能看到完整阶段：
  - `initSent`
  - `readyReceived`
  - `startSent`
  - `endReceived`

建议在模板中增加可观测日志（屏幕可见或 debug 面板）：

- 是否收到 init
- craft 是否解析成功
- ready 是否发送成功
- 是否收到 start
- end 是否发送成功

---

## 6. 验收清单（提交前必须自检）

资源相关验收项的完整版本见 `第9章`。

- 发布前在开发者平台完成测试（用户侧正式验收入口）
- 完整时序：`init -> ready -> start -> end`
- `9:16` 比例在容器内稳定
- build 产物可直接交付运行，核心 JS 不依赖远端脚本
- 已使用打包插件合并 JS，交付入口为 `dist/index.html`
- 核心入口与本地资源采用相对路径；若使用线上静态资源需验证可用性与降级策略
- 至少存在一个可达结束节点，不会无限循环无出口
- 解析失败有可见反馈

按模式补充：

- 直接作品模式：本地固定 JSON + 本地相对资源可直接运行
- craft 驱动模板模式：能从 `payload.extras.craft` 读取并运行外部 JSON

---

## 7. 常见问题排查

### Q1: App 里 ready 超时，但平台能跑

优先检查：

- 是否在 `onInit` 里确实调用了 `sendReady`
- 是否只在某些异步路径调用（导致有分支漏发）
- payload 的 `sessionId` 是否被改写（会被宿主判为 mismatch）

### Q2: craft 为空

- 如果你是直接作品模式：这是预期，可直接走本地 JSON
- 先看 `payload.extras.craft` 是否存在
- 若模板历史实现依赖 `payload.craft`，补兼容兜底读取
- 若你是 craft 驱动模板模式且两者都空，需检查宿主传参与模板读取逻辑

### Q3: 收到 start 后画面没进入互动

- 检查 `onStart` 回调是否已注册
- 检查是否被局部状态/防重逻辑提前 return

### Q4: 运行 `npx nianxie-gate preflight` 报错 `Missing script: "nx:package"`

原因：

- 当前版本的 `preflight` 会调用项目内 `nx:package` 与 `nx:verify:runtime` 脚本。
- 如果模板项目 `package.json` 未声明这些脚本，就会出现该错误。

修复：

1. 在模板项目 `package.json` 增加 `nx:*` 脚本映射（见 `第13章`）。
2. 之后统一用 `npm run nx:preflight` 执行，不直接裸跑其他自定义链路。

补充：

- AI 生成模板后，第一步先检查 `package.json` 是否存在 `nx:package`/`nx:verify:runtime`/`nx:preflight`，缺失则先补齐再执行验证。

### Q5: 使用 `vite-plugin-singlefile` 后，runtime 校验报协议缺失或 SDK 缺失

优先检查：

- 是否把 SDK 错误地写成 `index.html` 的 `./node_modules/...` 路径（构建后通常不可达）。
- 是否在业务代码里通过 npm import 接入 SDK（推荐做法）。
- `vite.config.ts` 是否为 `base: "./"`（避免生成绝对路径）。
- 是否仍处于 dev 产物（`@vite/client`、`import.meta.hot` 等）而非 build 产物。

CLI 口径说明：

- `nx:verify:runtime` 已支持 singlefile 场景，会同时扫描 `dist/*.js` 与 `index.html` 内联脚本。
- 协议闭环识别目标不变：`onInit/onStart/sendReady/sendEnd`。
- 资源校验同样覆盖 singlefile：会校验脚本中的媒体引用是否能命中 `dist`，并阻断绝对路径资源引用（如 `/assets/...`）。
- 开发者平台最终以运行时闭环表现为准，不强制要求 `index.html` 必须显式存在 `nianxie-interaction-sdk.js` 标签。
- 资源策略：未被入口引用的冗余资源默认不阻断；仅“被引用但路径错误/不可达”阻断。

---

## 8. SDK API 速查

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

类型定义见：`websdk/index.d.ts`

开发态诊断开关示例（不改变生产协议）：

```js
const sdk = NianxieInteractionSDK.createNianxieInteractionSDK({
  diagnostics: {
    enabled: true,
    readyTimeoutMs: 8000,
    endTimeoutMs: 120000,
    onEvent: (event) => {
      // event: { level, phase, errorCode, suggestion, detail, ts }
      console.log('[sdk-diag]', event);
    },
  },
});
```

---

## 9. 资源依赖、加载与开发者平台发布说明

本章节说明模板如何管理静态资源、如何通过构建得到可发布产物，以及如何避免上传到开发者平台后出现图片/音频无法加载。

重要前提（开发者平台行为）：

- 开发者平台可能对上传包做处理，例如图片转 WebP、路径重写、文件重命名。
- 如果代码依赖运行时拼接路径、写死扩展名（`.jpg`/`.png`）或仅在 JSON 写路径字符串，平台处理后容易出现 404 或加载错误。
- 按本章节的必须规则实现并完成上传前自检，可从工程层面规避这类问题。

### 9.1 核心原则（必须遵守）

1. 随作品发布的本地图片/音频，必须通过静态 `import ... from "./assets/xxx?url"` 纳入依赖图。  
2. 禁止运行时拼接资源路径（如 `"./assets/" + id + ".png"`、`` `./assets/${name}.${ext}` ``）。  
3. `game.json`/craft JSON 中的路径字符串只作为逻辑键，不会自动触发打包。  
4. 不要假设线上扩展名与本地一致；业务运行以构建后的 URL 字符串为准。  
5. 音频同样要进入依赖图；不要依赖未映射的相对路径直链。  

### 9.2 标准做法（推荐唯一主路径）

| 环节 | 做法 |
|------|------|
| 源文件位置 | 放在 `src/assets/` |
| 登记依赖 | 在 `src/asset-urls.js` 中逐条 `import url from "./assets/xxx?url"` |
| 逻辑键映射 | 用 `PATH_TO_URL` 将逻辑键映射到构建 URL |
| 数据文件 | `src/data/game.json` 里保留逻辑路径，仅作键 |
| 运行时处理 | 校验后调用 `normalizeGameDataAssets(data)` 再预加载/渲染 |

说明：

- 逻辑键可保留 `.jpg` 这类本地后缀，但实际加载必须使用映射后的 URL。
- CSS 背景图建议使用已解析 URL（如 `url(${JSON.stringify(path)})`）避免特殊字符截断。

### 9.3 与“平台转 WebP”的关系

- 错误做法：依赖扩展名拼接（`foo.png` 或 `base + ".webp"`）。  
- 正确做法：仅使用构建期 `import ?url` 解析得到的 URL。  
- 若平台上传后再次处理资源，仍应以交付物中的构建结果 URL 为准，而非运行时重拼路径。  

### 9.4 禁止清单（出现即高风险）

- 运行时字符串拼接生成资源 URL
- 根据 `endsWith(".png")` 等后缀分支加载
- 仅在 JSON/CSS 写路径但未在 `asset-urls.js` 静态 `import`
- 仅依赖 `fetch` 读取包内 `game.json` 作为唯一数据源（宿主可能返回 HTML）
- 假设 `dist` 目录结构与本地开发目录永远完全一致

### 9.5 构建与发布流程

```bash
npm install
npm run build
```

- 以 `dist/` 作为交付物（入口通常为 `dist/index.html`）。
- 上传开发者平台时按要求上传完整构建产物（包含 `dist/assets` 等目录）。
- 若使用单文件插件，交付可能是单一大 HTML；若体积超限需单独评估资源策略。

### 9.6 上传前资源自检

- [ ] 新增/替换图片音频后，已在 `src/asset-urls.js` 增加 `import ?url` 与映射条目。
- [ ] `src/data/game.json`（以及 craft 中如有）逻辑键与 `PATH_TO_URL` 键一致。
- [ ] 代码库不存在资源路径运行时拼接（可全局搜索 `assets` 与模板字符串/拼接逻辑）。
- [ ] 已执行 `npm run build`，上传的是当前 `dist`，不是 `src`。
- [ ] 使用线上静态资源（如 OSS）时，已验证真机可访问并有降级方案。

补充口径：

- 本规范允许线上静态资源（OSS 图片/音频等）。
- 但对“随包发布资源”的强保证，仍以静态 import + 映射方案为准。

---

## 10. 本地宿主模拟器（与平台错误对齐）

命令：`npm run nx:simulate:host`

用途：

- 在本地对 `dist` 产物执行宿主侧最小模拟检查，输出 `reports/local-host-simulator.json`
- 输出阶段与平台保持一致：`initSent -> readyReceived -> startSent -> endReceived`
- 输出错误结构与平台一致：`errorCode`、`phase`、`suggestion`

说明：

- 该命令用于“开发态自检”和问题定位，不替代 `nx:verify:runtime` 阻断闸门。
- 若本地模拟器已出现阻断项，必须先修复再继续提交流程。

## 11. 统一错误码字典（平台/脚本/AI 通用）

错误码定义在 `websdk/error-codes.json`，要求：

- 平台校验、模板自检脚本、AI 修复建议必须使用同一 `errorCode`
- 每个错误码必须提供：
  - `phase`：`package` 或 `runtime`
  - `severity`：`warning` 或 `blocking`
  - `suggestion`：可直接执行的修复建议

AI 在读取 `reports/*.json` 后，必须按 `errorCode -> suggestion` 给出修复动作，不得只返回泛化描述。

## 12. 命令契约（AI 与开发者共用）

- 推荐统一入口：`npm run nx:*`（避免漏配脚本导致链路不可用）。
- `npx nianxie-gate <command>` 可作为底层执行器，但 `preflight` 依赖项目已声明 `nx:*` 脚本。
- `nx:verify:runtime` 同时支持“多文件 dist”与 `vite-plugin-singlefile` 内联脚本产物。
- `npm run nx:package`
  - 退出码：`0`（warning 不阻断）
  - 报告：`reports/package-report.json`
- `npm run nx:verify:runtime`
  - 退出码：`0=通过`，`1=阻断失败`
  - 报告：`reports/runtime-verify.json`
- `npm run nx:preflight`
  - 行为：顺序执行 `nx:package` -> `nx:verify:runtime`
  - 规则：仅 runtime 阻断项决定成功/失败
- `npm run nx:submit:prepare`
  - 仅在 `nx:preflight` 通过后输出上传包路径与摘要

## 13. 模板工程自检闸门（本地/CI）

推荐在模板工程的 `package.json` 固定以下脚本（与本仓脚本同名）：

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

接入后建议先执行一次：

```bash
npm run nx:preflight
```

CI 侧执行建议：

1. PR 阶段：执行 `npm run nx:package`，允许 warning，但必须上传 `reports/package-report.json`
2. 合并前闸门：执行 `npm run nx:verify:runtime`，若退出码非 0 则阻断
3. 发布前：执行 `npm run nx:submit:prepare`，归档 `dist.zip` 与 `reports/*.json`

这样可保证“打包期提示风险、运行期阻断硬错误”的双阶段策略稳定执行。

## 14. 人工/AI 按报告修复的标准闭环

该流程适用于开发者手工修复，也适用于 AI 自动修复。

### 14.1 固定循环

1. 执行 `npm run nx:preflight`（或分步执行 `nx:package` + `nx:verify:runtime`）。
2. 读取 `reports/package-report.json` 与 `reports/runtime-verify.json`。
3. 按 `errorCode` 定位并修复代码/配置问题。
4. 再次执行 `npm run nx:preflight`。
5. 直到满足：
   - `package-report.json.warningCount` 可为 `0`（建议）或可接受范围；
   - `runtime-verify.json.blockingCount` 必须为 `0`。

### 14.2 修复优先级

- 优先修 `runtime` 阻断项（`severity=blocking`）：未清零不得提交。
- 再处理 `package` 警告项（`severity=warning`）：建议在发布前尽量清零。

### 14.3 AI 执行约束（必须）

- AI 不得跳过报告读取步骤，不得只看终端摘要。
- AI 必须基于 `errorCode -> suggestion` 输出“具体修改动作 + 目标文件”。
- AI 每轮修复后必须重新跑 `nx:preflight`，并附带新的 `reports/*.json` 结果。
- 若遇到 `Missing script: "nx:package"`，先补 `package.json` 的 `nx:*` 脚本映射再继续。

### 14.4 最小交付判定

仅当满足以下条件，才允许进入“提交开发者平台”：

- `reports/runtime-verify.json` 中 `ok=true` 且 `blockingCount=0`
- `dist.zip` 已生成
- `reports/submit-prepare.json` 已生成并包含 `uploadArtifact` 与 `sha256`
