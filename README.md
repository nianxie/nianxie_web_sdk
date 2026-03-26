# Web SDK: Nianxie Interaction SDK

`websdk/nianxie-interaction-sdk.js` 用于 Web 与 Flutter 的交互通信。

## 核心规则（重要）

- `sessionId/itemId/title` **强制带上**，由 SDK 自动管理并透传。
- 开发者**不要手动维护**这三个字段，只传业务参数 `extras`。
- Flutter 会在 WebView 初始化时注入上下文，SDK 自动读取。

## 信号协议

推荐统一采用四段式：

1. Flutter -> Web: `init`（`window.OnMiniInit(payload)`）
2. Web -> Flutter: `ready`（`NianxieMiniReady`）
3. Flutter -> Web: `start`（`window.OnMiniStart(payload)`，同时 Flutter 隐藏 entry cover）
4. Web -> Flutter: `end`（`NianxieMiniEnd`）

- JS -> Flutter
  - `NianxieMiniReady`：互动资源就绪
  - `NianxieMiniEnd`：互动结束
- Flutter -> JS
  - `window.OnMiniInit(payload)`：初始化信号（拿到 sessionId/itemId/title，加载资源）
  - `window.OnMiniStart(payload)`：开始互动
  - `window.OnMiniContext(payload)`：上下文同步（可选，SDK 自动监听）

## 1) 原生 JS 用法

```html
<script src="./nianxie-interaction-sdk.js"></script>
<script>
  const sdk = NianxieInteractionSDK.createNianxieInteractionSDK({
    source: "webview",
    defaultTimeoutMs: 10000,
  });

  const offInit = sdk.onInit(async (payload) => {
    console.log("init payload:", payload);
    // 在这里做资源初始化，初始化完成后上报 ready
    await sdk.sendReady({
      extras: { stage: "assets-loaded" },
    });
  });

  const offStart = sdk.onStart((payload) => {
    console.log("start payload:", payload);
    // Flutter 已发 start，开始真正执行互动
  });

  async function finishInteraction() {
    await sdk.sendEnd({
      extras: { result: "success", score: 98 },
    });
  }

  // 页面销毁
  // offInit();
  // offStart();
  // sdk.destroy();
</script>
```

## 2) React 用法

```javascript
import { useEffect, useMemo } from "react";

export default function MiniPage() {
  const sdk = useMemo(
    () => window.NianxieInteractionSDK.createNianxieInteractionSDK(),
    []
  );

  useEffect(() => {
    const offInit = sdk.onInit(async (payload) => {
      console.log("OnMiniInit", payload);
      await sdk.sendReady({ extras: { stage: "assets-loaded" } });
    });
    const offStart = sdk.onStart(() => {
      console.log("OnMiniStart");
      // 这里开始互动主流程
    });
    return () => {
      offInit();
      offStart();
      sdk.destroy();
    };
  }, [sdk]);

  const onEnd = async () => {
    await sdk.sendEnd({ extras: { result: "done" } });
  };

  return (
    <div>
      <button onClick={onEnd}>End</button>
    </div>
  );
}
```

## 3) Vue 3 用法

```javascript
import { onMounted, onBeforeUnmount } from "vue";

export default {
  setup() {
    const sdk = window.NianxieInteractionSDK.createNianxieInteractionSDK();
    let offStart = null;
    let offInit = null;

    onMounted(() => {
      offInit = sdk.onInit(async (payload) => {
        console.log("OnMiniInit", payload);
        await sdk.sendReady({ extras: { from: "vue-init" } });
      });
      offStart = sdk.onStart((payload) => {
        console.log("OnMiniStart", payload);
        // 开始互动
      });
    });

    onBeforeUnmount(() => {
      if (offInit) offInit();
      if (offStart) offStart();
      sdk.destroy();
    });

    const onEnd = async () => {
      await sdk.sendEnd({ extras: { reason: "user-finish" } });
    };

    return { onEnd };
  },
};
```

## 扩展能力（未来接口）

未来 Flutter 新增 handler（相册/用户数据）时，SDK 无需改内核：

```javascript
const sdk = NianxieInteractionSDK.createNianxieInteractionSDK();

sdk.registerRequests({
  pickImage: "NianxiePickImage",
  getUserProfile: "NianxieGetUserProfile",
});

const image = await sdk.request("pickImage", {
  extras: { maxCount: 1, mediaType: "image" },
});

const profile = await sdk.request("getUserProfile");
```

> `request/sendReady/sendEnd` 会自动带上 SDK 内部维护的 `sessionId/itemId/title`。

## API 一览

- `createNianxieInteractionSDK(options)`
- `sdk.getVersion()`
- `sdk.isBridgeAvailable()`
- `sdk.waitForBridge({ timeoutMs, intervalMs })`
- `sdk.waitForContext({ timeoutMs, intervalMs })`
- `sdk.getContext()`
- `sdk.buildPayload(eventId, params)`
- `sdk.sendReady({ extras }, { timeoutMs })`
- `sdk.sendEnd({ extras }, { timeoutMs })`
- `sdk.request(name, { extras }, { timeoutMs })`
- `sdk.registerRequest(name, handlerName)`
- `sdk.registerRequests(map)`
- `sdk.getRegisteredRequests()`
- `sdk.onInit(callback)`
- `sdk.onStart(callback)` / `sdk.mount({ onInit, onStart })`
- `sdk.destroy()`

## 安全与稳健性

- handler 名合法性校验
- payload 深度清洗（过滤危险键）
- 调用超时保护
- bridge 可用性检查
- 上下文缺失时拒绝发送（防止脏数据）
