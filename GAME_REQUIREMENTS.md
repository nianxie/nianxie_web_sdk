# 游戏网页制作需求规范

本文档用于指导 AI 或开发者实现一个可接入平台的网页游戏。  
目标是约束运行协议与交付标准，而不是限制玩法创意。

核心定义：最终实现的网页本质上是一个“游戏解释器/执行器”，可以将符合 JSON Schema 的 JSON（craft）翻译为可运行的游戏流程与交互画面。

## 1. 目标与边界

- 目标：实现可运行、可接入 WebSDK、可由外部 JSON 驱动的网页游戏。
- 本质目标：实现“Schema 定义 -> JSON 输入 -> 游戏运行”的稳定转换能力。
- 边界：不限定题材、玩法、画风、交互细节、内部状态实现方式。
- 强约束：必须遵守输入协议、事件时序、打包交付与结束闭环规则。

## 2. 必须满足的技术要求

### 2.1 JSON Schema + 引擎 + 外部 JSON 驱动

- 游戏内容必须通过外部 JSON（craft）驱动，而不是写死在代码中。
- 必须提供 Schema（建议 Zod + 导出 JSON Schema）用于校验传入 JSON。
- 运行时流程必须是：接收外部 JSON -> 校验 -> 加载 -> 运行。

### 2.2 WebSDK 接入要求

- 必须获取并接入 `@nianxie/nianxie-interaction-sdk`。
- 建议安装命令（GitHub Packages）：
  - `npm install @nianxie/nianxie-interaction-sdk@0.1.0 --registry=https://npm.pkg.github.com`
  - 或：`npm install @nianxie/nianxie-interaction-sdk --@nianxie:registry=https://npm.pkg.github.com`
- 必须按 WebSDK 时序组织逻辑：
  1. 收到 `init`
  2. 读取并解析 `payload.extras.craft`
  3. 校验并准备运行数据
  4. 发送 `ready`
  5. 收到 `start` 后开始互动
  6. 达到结束条件后发送 `end`

### 2.3 画面比例与容器规则

- 游戏主画面必须按 `9:16` 排版。
- 页面本身应可全屏适配，最终显示尺寸由外层容器限制。
- 不要求固定像素宽度，要求始终保持纵向 9:16 视觉比例。

### 2.4 打包交付要求

- `npm run build` 后产物需尽量打成单文件（优先内联 JS/CSS）。
- 交付产物不得依赖远端 JS/CDN 才能运行。
- dist 应具备离线可打开能力（在宿主容器中不因资源路径失效崩溃）。
- 推荐采用当前项目方案（Vite 单文件插件）：
  1. 安装：`npm install vite-plugin-singlefile`
  2. 在 `vite.config.ts` 中启用：`viteSingleFile()`
  3. 执行：`npm run build`
  4. 结果：`dist/index.html` 内联核心 JS/CSS，可作为优先交付物

## 3. Schema 约束（最低要求）

- 图片字段使用：
  - `z.string().describe(JSON.stringify({ type: "image", description: "xxx图片的描述" }))`
- 禁止使用 `record` 结构作为运行数据主结构（推荐数组对象结构）。
- Schema 必须可导出为标准 JSON Schema（建议 draft-07）。
- 传入 JSON 必须能被 Schema 明确判定“通过/失败”。

## 4. 开始与结束闭环（强约束）

为防止游戏卡死或无限循环，必须满足：

- 必须有明确开始触发（例如收到 `start` 后进入可交互态）。
- 必须有明确结束触发（例如进入结局场景 `isEnding=true`）。
- 必须保证从开始路径可达至少一个结束节点。
- 禁止仅靠循环场景/选项无限跳转而没有终止出口。
- 到达结束条件时必须稳定触发 `end` 信号（不遗漏、不重复刷屏）。

## 5. 运行时容错与可观测性

- 解析失败必须有可见反馈（不仅是 console）。
- 关键节点建议屏幕内可见：
  - 是否收到 init
  - craft 是否解析成功
  - ready 是否发送成功
  - end 是否发送成功
- 资源加载失败不应直接导致主流程崩溃；应有降级或超时处理策略。

## 6. 推荐实现（非强制）

- 技术栈：React + TypeScript + Tailwind + Framer Motion
- 文本：可使用打字机效果
- 切换：背景和角色切换使用过渡动画
- 结构：引擎层与 UI 层分离，便于替换玩法逻辑

## 7. 验收清单

- 能从 `payload.extras.craft` 读取并运行外部 JSON。
- `init -> ready -> start -> end` 时序完整。
- 9:16 比例稳定，外层容器限制下显示正常。
- build 产物可直接交付运行，不依赖远端 JS。
- 存在可达结束节点，不会无限循环无退出。
- Schema、引擎、JSON 三者一致，更新后可通过自检。

## 8. 开发自由度说明

以下内容可自由发挥：

- 玩法机制（消除、跑酷、对战、解谜、互动叙事等）
- 视觉风格（像素风、插画风、UI 皮肤）
- 动画与反馈方式
- 内部状态机细节和代码组织方式

前提是：不破坏本文档中的运行规范和对接协议。
