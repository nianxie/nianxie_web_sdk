# Nianxie Unity WebGL 模版完整接入手册（Unity 版）

本手册是 UnityWebGLTmpl 分支的主文档，按固定 4 部分组织，方便人和 AI 直接执行：

1. 信号说明（协议与时序）
2. 作品制作（Playable Work）
3. 模版制作（Configurable Template）
4. 提供的指令（校验、提交流程、报告）

---

## 0. 快速开始（本地可运行 + UPM 可安装）

你可以用下面任意一种方式接入：

### 方式 A：本地拷贝（最快）

1. 把 `Assets/*` 拷贝到你的 Unity 项目 `Assets/`。
2. 在 Unity 里选择 `WebGL Template = NianxieTemplate`。
3. 场景中创建 `NianxieBridge` 对象并挂脚本。
4. Build WebGL 后即可在宿主环境联调。

### 方式 B：UPM 本地路径安装（推荐本地开发）

在 Unity `Packages/manifest.json` 增加：

```json
{
  "dependencies": {
    "com.nianxie.webgl-template": "file:../path/to/nianxie_web_sdk/unity/UnityWebGLTmpl"
  }
}
```

安装完成后，在 Unity 菜单执行：

- `Tools/Nianxie/Install WebGL Template To Assets`

该菜单会把必须文件复制到项目 `Assets/`，复制后即可直接运行。

### 方式 C：UPM Git URL 安装（团队协作）

在 Unity `Packages/manifest.json` 增加：

```json
{
  "dependencies": {
    "com.nianxie.webgl-template": "https://github.com/nianxie/nianxie_web_sdk.git?path=/unity/UnityWebGLTmpl#UnityWebGLTmpl"
  }
}
```

然后同样执行：

- `Tools/Nianxie/Install WebGL Template To Assets`

> 说明：WebGL Template 与 jslib 最终建议落到项目 `Assets/`，这样最稳定、最符合 Unity 常见构建行为。

---

## 第一部分：信号说明

本章节回答三个问题：**谁发信号、什么时候发、发错会怎样**。

### 1.1 四段式生命周期（必须闭环）

宿主验收只认下面四段闭环：

1. `init`：Host 发 `window.OnMiniInit(payload)`
2. `ready`：Unity 通过 `NxSendReady` 回传
3. `start`：Host 发 `window.OnMiniStart(payload)`
4. `end`：Unity 通过 `NxSendEnd` 回传

如果缺任意一段，平台可判定为运行不合格。

### 1.2 实际链路（Host / JS / Unity）

在 Unity WebGL 模版里，信号路径是：

1. Host -> JS：`OnMiniInit(payload)`
2. JS -> Unity：`SendMessage("NianxieBridge", "OnMiniInit", payloadJson)`
3. Unity -> JS：调用 `NxSendReady(extrasJson)`（来自 jslib）
4. JS -> Host：SDK 转发为 `NianxieMiniReady`
5. Host -> JS：`OnMiniStart(payload)`
6. JS -> Unity：`SendMessage("NianxieBridge", "OnMiniStart", payloadJson)`
7. Unity -> JS：调用 `NxSendEnd(extrasJson)`
8. JS -> Host：SDK 转发为 `NianxieMiniEnd`

### 1.3 payload 约束（避免被宿主拒收）

- 不要在 Unity 侧重写 `sessionId / itemId / title`。
- 业务数据统一放 `extras`。
- 模版模式下，craft 读取顺序应为：
  - 首选：`payload.extras.craft`
  - 兜底：`payload.craft`

### 1.4 Unity 侧关键对象与函数

- 场景对象：`NianxieBridge`（名称必须一致）
- 挂载脚本：`Assets/Scripts/NianxieBridge.cs`
- Unity 接收回调：
  - `OnMiniInit(string payloadJson)`
  - `OnMiniStart(string payloadJson)`
- Unity 回传函数：
  - `NotifyHomeReady()`（推荐）
  - `SendReady(string extrasJson = "{}")`
  - `SendEnd(string extrasJson = "{}")`

### 1.5 推荐时机（避免 ready/end 过早）

- `ready`：主菜单、首屏资源、关键输入都可用后再发。
- `end`：流程完成（成功/失败/退出）后立刻发，不要只在成功路径发。

---

## 第二部分：作品制作（Playable Work）

本节适用于“可上传 + 可运行”的 Unity 单作品，不依赖外部 craft。

### 2.1 目标定义

- 上传后可正常启动
- 能走完 `init -> ready -> start -> end`
- 在 9:16 容器内显示稳定

### 2.2 一次性接入步骤

1. 安装模板（二选一）  
   - 本地拷贝：将当前目录 `Assets/*` 拷贝到你的 Unity 项目 `Assets/`。  
   - UPM 安装：先通过 `manifest.json` 引入 `com.nianxie.webgl-template`，再运行菜单  
     `Tools/Nianxie/Install WebGL Template To Assets`。

2. 选择 WebGL Template  
   `Project Settings -> Player -> WebGL -> Resolution and Presentation -> WebGL Template`  
   选择 `NianxieTemplate`。

3. 配置桥对象  
   在首场景创建 `NianxieBridge` GameObject，并挂载 `NianxieBridge.cs`。

4. 在主界面可见后发送 ready  
   例如主菜单 `OnEnable` 或首帧布局稳定后调用：
   `NianxieBridge.NotifyHomeReady()`。

5. 在流程结束处发送 end  
   在通关、失败、提前退出等所有出口调用 `SendEnd(...)`。

### 2.3 推荐代码组织（Unity）

- 不要在多个脚本分散调用 `SendReady`，避免重复发送。
- 将结束上报封装为统一方法（如 `FinishInteraction(result)`），所有退出路径复用。
- UI 层只触发意图，状态判定放在主流程控制器。

### 2.4 作品模式常见错误

- 收到 init 但不发 ready（最常见）
- 只在“成功结局”发 end，失败/退出漏发
- 资源还没准备好就发 ready，导致 start 后黑屏
- 使用绝对路径资源（`/assets/...`）导致宿主环境失效

### 2.5 发布前必过清单

- [ ] `OnMiniInit` 被调用
- [ ] `NotifyHomeReady` 或 `SendReady` 在正确时机执行
- [ ] `OnMiniStart` 被调用
- [ ] 任意结束路径都调用 `SendEnd`
- [ ] 9:16 竖屏布局无裁切/错位
- [ ] 异常时有可见反馈（Toast/面板/错误页）

---

## 第三部分：模版制作（Configurable Template）

本节适用于“可上传 + 可配置 + 可运行”的 Unity 模版。

### 3.1 目标定义

- 能消费外部 craft 数据
- 能用同一套 Unity 工程承载不同内容
- 仍满足完整四段式信号闭环

### 3.2 模版与作品的核心区别

- 作品模式：数据通常固定在包内
- 模版模式：运行内容由 `extras.craft` 驱动，不应写死

### 3.3 建议数据流（Unity）

1. `OnMiniInit(payloadJson)` 收到原始 payload
2. 解析 JSON，提取 `extras.craft`（若空再看 `craft`）
3. 执行数据校验（字段完整性、枚举值、资源引用）
4. 映射为 Unity 内部模型（如 Scriptable DTO / Runtime State）
5. 资源预加载
6. 资源就绪后发送 `ready`
7. 收到 `start` 后进入互动
8. 结束时发送 `end`

### 3.4 模版质量下限（建议强制）

- 至少一个可达结束节点（不允许无尽循环）
- 解析失败必须可见（不是只打 Console）
- 关键节点有诊断日志：
  - init received
  - craft parse ok/fail
  - ready sent
  - start received
  - end sent

### 3.5 资源策略（Unity 模版务必注意）

- 本地随包资源优先使用相对路径。
- 不要在运行时拼接本地资源路径字符串。
- 若使用线上资源（如 OSS），必须有失败降级：
  - 占位图
  - 重试
  - 超时回退

### 3.6 建议的失败处理分层

- 输入失败：craft 缺失/格式错误 -> 展示错误页 + 不发送 ready
- 资源失败：关键资源不可用 -> 展示降级 UI + 允许退出并上报 end
- 运行失败：逻辑异常 -> 捕获后上报可诊断信息，再结束流程

---

## 第四部分：提供的指令

本节给出 Unity 交付链路最常用命令。  
命令执行目录：导出后的 Web 工程根目录（包含 `dist/`）。

### 4.0 Unity Editor 指令（安装期）

- `Tools/Nianxie/Install WebGL Template To Assets`
  - 从 UPM 包复制以下文件到项目 `Assets/`：
    - `Assets/Scripts/NianxieBridge.cs`
    - `Assets/Plugins/WebGL/nianxie_bridge.jslib`
    - `Assets/WebGLTemplates/NianxieTemplate/*`
- `Tools/Nianxie/Open WebGL Template Settings`
  - 快速打开 Player Settings，方便切换 `WebGL Template`

### 4.1 快速校验（推荐顺序）

1. 运行时阻断校验

```bash
node tools/nx-verify-runtime.js
```

2. 本地宿主模拟

```bash
node tools/local-host-simulator.js
```

### 4.2 统一入口命令（可选）

```bash
node tools/nianxie-gate.js verify-runtime
node tools/nianxie-gate.js simulate-host
node tools/nianxie-gate.js package
node tools/nianxie-gate.js preflight
node tools/nianxie-gate.js submit-prepare
```

### 4.3 报告文件说明

- `reports/runtime-verify.json`
  - 是否通过阻断校验
  - blocking 问题清单
- `reports/local-host-simulator.json`
  - 本地模拟的阶段轨迹与错误
- `reports/package-report.json`
  - 打包阶段 warning 摘要
- `reports/submit-prepare.json`
  - 最终上传包路径、摘要、sha256

### 4.4 推荐提交流程（Unity 团队）

```bash
node tools/nianxie-gate.js preflight
node tools/nianxie-gate.js submit-prepare
```

通过标准：

- `runtime-verify.json` 中 `ok=true`
- `blockingCount=0`
- 已生成 `dist.zip`

---

## Unity 现场排错速查

### A) ready 超时

- 是否实际收到 `OnMiniInit`
- 是否所有分支都能执行到 `NotifyHomeReady`/`SendReady`
- 是否因为资源加载异常提前返回

### B) start 后无互动

- `OnMiniStart` 是否进入 Unity
- 交互控制器是否在 start 前被禁用
- 状态机是否卡在 loading 状态

### C) end 未被宿主接收

- 是否只在成功分支调用 `SendEnd`
- `extrasJson` 是否是合法 JSON
- 是否在对象销毁后才调用 `SendEnd`

### D) 资源在本地可用、平台失效

- 是否存在绝对路径 `/assets/...`
- 是否依赖 dev 产物特性（HMR、localhost）
- 是否遗漏构建后的实际资源文件

---

## 最小落地建议（给团队）

如果你要快速稳定交付 Unity 模版，优先做三件事：

1. 首屏可见时稳定发送 `ready`
2. 所有结束路径统一发送 `end`
3. 提交前固定跑一次 `verify-runtime + simulate-host`

只要这三项稳定，线上成功率会明显提升。
# Nianxie Unity WebGL 模版说明（Unity 版）

本 README 给 Unity 团队的完整接入方式，同样按 **4 个固定部分**组织：

1. 信号说明（协议与时序）
2. 作品制作（Unity 可上传 + 可运行）
3. 模版制作（Unity 可上传 + 可配置 + 可运行）
4. 提供的指令（Unity 工程可执行命令）

---

## 第一部分：信号说明

### 1) Unity 接入的四段式时序（必须）

1. Host -> JS: `window.OnMiniInit(payload)`
2. JS -> Unity: `SendMessage("NianxieBridge", "OnMiniInit", payloadJson)`
3. Unity -> Host: `NxSendReady(...)`
4. Host -> JS: `window.OnMiniStart(payload)`
5. JS -> Unity: `SendMessage("NianxieBridge", "OnMiniStart", payloadJson)`
6. Unity -> Host: `NxSendEnd(...)`

实际验收口径仍是 `init -> ready -> start -> end` 四段闭环。

### 2) 文件职责

- `Assets/Scripts/NianxieBridge.cs`
  - Unity 侧桥对象（接收 init/start，发送 ready/end）
- `Assets/Plugins/WebGL/nianxie_bridge.jslib`
  - Unity WebGL 插件导出（`NxSendReady/NxSendEnd/NxPop*`）
- `Assets/WebGLTemplates/NianxieTemplate/nianxie-web-bridge.js`
  - JS 桥接层（Host <-> Unity）
- `Assets/WebGLTemplates/NianxieTemplate/nianxie-interaction-sdk.js`
  - 协议 SDK

### 3) Unity 场景最低要求

- 场景内必须存在名为 `NianxieBridge` 的 GameObject。
- 该对象必须挂载 `NianxieBridge.cs`。
- 首页可见后再发 `NotifyHomeReady()`（推荐）。

---

## 第二部分：作品制作（Unity Playable Work）

适用场景：Unity WebGL 单作品，不依赖外部 craft。

### 1) 接入步骤

1. 将 `unity/UnityWebGLTmpl/Assets/*` 拷贝到 Unity 项目 `Assets/`。
2. Unity 设置 `Project Settings -> Player -> WebGL -> WebGL Template` 为 `NianxieTemplate`。
3. 创建并挂载 `NianxieBridge`（见上文）。
4. Build WebGL，确保导出产物有 `dist/index.html`。

### 2) Ready / End 建议

- `ready`：主页或主菜单真正可见后发送（不要过早）。
- `end`：交互结束时发送，保证路径可达。

### 3) 自检清单

- [ ] `OnMiniInit` 被接收
- [ ] `NotifyHomeReady()` 或 `SendReady()` 实际成功
- [ ] `OnMiniStart` 被接收
- [ ] `SendEnd()` 实际成功
- [ ] 9:16 容器显示正确

---

## 第三部分：模版制作（Unity Configurable Template）

适用场景：Unity 模版由外部 craft 驱动（可复用）。

### 1) 目标

- 可上传
- 可配置（消费外部 craft）
- 可运行

### 2) Unity 读取 craft 的建议路径

- 在 `OnMiniInit(string payloadJson)` 中解析 payload
- 优先读取 `extras.craft`，再兜底 `craft`
- 把解析结果映射到 Unity 内部状态机/数据模型

### 3) 模版质量建议

- 初始化失败时，UI 需要给出可见错误提示
- 至少有一个可达结束节点，避免无尽流程
- 对关键阶段保留日志（init/start/ready/end）

---

## 第四部分：提供的指令

以下命令在导出后 Web 工程根目录执行（需包含 `dist/`）：

### 1) 运行时校验

```bash
node tools/nx-verify-runtime.js
```

或：

```bash
node tools/nianxie-gate.js verify-runtime
```

报告输出：`reports/runtime-verify.json`

### 2) 本地宿主模拟

```bash
node tools/local-host-simulator.js
```

或：

```bash
node tools/nianxie-gate.js simulate-host
```

报告输出：`reports/local-host-simulator.json`

### 3) 若接入 npm 脚本（推荐）

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

推荐提交流程：

```bash
npm run nx:preflight
npm run nx:submit:prepare
```

---

## Unity 版本快速排错

- ready 超时：确认 `OnMiniInit` 后是否一定调用了 `NotifyHomeReady()`/`SendReady()`。
- start 无响应：确认 `OnMiniStart` 已到达 Unity 且未被状态机提前 return。
- end 未上报：确认结束分支确实调用 `SendEnd()`。
- 资源异常：优先检查是否存在绝对路径引用（`/assets/...`）。
