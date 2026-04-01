# WebSDK 模板制作与接入总规范

本文档是唯一权威规范，面向：

- AI 代理（按规则自动生成小游戏模板）
- 开发者（手工实现可上传、可运行的模板）

目标是保证产物可以：

1. 在开发者平台上传并通过试运行
2. 在 App 内完成一次完整握手与运行：`init -> ready -> start -> end`
3. 作为“可上传 + 可生成 + 可运行”的模板被复用

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

- 模板运行数据优先从 `payload.extras.craft` 读取。
- `payload.craft` 仅可作为兼容兜底，不应作为主通道。
- 读取后必须进行 schema 校验，校验失败要可见反馈（不仅 console）。

---

## 2. 模板引擎最低能力

模板本质是“解释器/执行器”：

- 输入：外部 JSON（craft）
- 过程：解析 + 校验 + 转换为内部状态
- 输出：可交互的游戏流程与画面

最低要求：

- 运行内容由外部 craft 驱动，不允许把故事/关卡完全写死
- 具备 schema（建议 Zod + JSON Schema 导出）
- 有明确开始和结束条件，且开始路径可达至少一个结束节点

---

## 3. 画面与交付约束

### 3.1 画面比例

- 主画面必须兼容 `9:16` 纵向容器
- 页面可自适应，但视觉比例不能跑偏

### 3.2 打包交付

- `npm run build` 后产物可直接交付
- 不依赖远端 CDN JS 才能运行（离线/内网也可启动）
- 推荐单文件策略（如 `vite-plugin-singlefile`），优先 `dist/index.html`

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
    if (!craft) {
      // 需要可见错误提示
      document.body.innerText = "craft 缺失，无法运行";
      return;
    }

    // 1) 校验 craft  2) 加载资源  3) 准备完成后发送 ready
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

## 5. 上传 + 生成 + 运行 对齐要求

要支持“可上传 + 可生成 + 可运行模板”，需同时满足：

- mini 本身可在开发者平台试运行通过
- 模板能消费来自生成链路的 craft JSON（即 `aigenAfterJson` 注入后的 craft）
- App 侧握手日志应能看到完整阶段：
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

- 能从 `payload.extras.craft` 读取并运行外部 JSON
- 完整时序：`init -> ready -> start -> end`
- `9:16` 比例在容器内稳定
- build 产物可直接交付运行，不依赖远端 JS
- 至少存在一个可达结束节点，不会无限循环无出口
- 解析失败有可见反馈

---

## 7. 常见问题排查

### Q1: App 里 ready 超时，但平台能跑

优先检查：

- 是否在 `onInit` 里确实调用了 `sendReady`
- 是否只在某些异步路径调用（导致有分支漏发）
- payload 的 `sessionId` 是否被改写（会被宿主判为 mismatch）

### Q2: craft 为空

- 先看 `payload.extras.craft` 是否存在
- 若模板历史实现依赖 `payload.craft`，补兼容兜底读取
- 若两者都空，需检查上游注入流程（非模板代码问题）

### Q3: 收到 start 后画面没进入互动

- 检查 `onStart` 回调是否已注册
- 检查是否被局部状态/防重逻辑提前 return

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
- `sdk.destroy()`

类型定义见：`websdk/index.d.ts`
