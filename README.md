# Nianxie WebSDK 简明说明书

基础接入说明。

## 1. SDK 接入方式

### 安装

```bash
npm install @nianxie/nianxie-interaction-sdk --@nianxie:registry=https://npm.pkg.github.com
```

or

```bash
git clone https://github.com/nianxie/nianxie_web_sdk.git
```

### 最小接入代码

```html
<script src="./nianxie-interaction-sdk.js"></script>
<script>
  const sdk = NianxieInteractionSDK.createNianxieInteractionSDK({
    source: "webview",
    defaultTimeoutMs: 10000,
  });

  sdk.onInit(async () => {
    await sdk.sendReady({ extras: { stage: "ready" } });
  });

  sdk.onStart(() => {
    // start 后进入交互
  });

  async function finish() {
    await sdk.sendEnd({ extras: { result: "completed" } });
  }
</script>
```

### 接入要求

- 入口文件是 `dist/index.html`
- 本地资源使用相对路径（如 `./assets/...`）
- 业务字段统一放在 `extras`

## 2. 信号量（⚠️ 必须）

> ⚠️ **必须实现**：信号量协议不是可选项，必须完整走完这 4 个信号。

1. `OnMiniInit`（Flutter -> Web）：收到信号后开始初始化页面(资源、逻辑准备等)
2. `NianxieMiniReady`（Web -> Flutter）：页面准备完成后发送ready信号给宿主，但暂不开始
3. `OnMiniStart`（Flutter -> Web）：收到宿主发来的开始信号，开始正常运行
4. `NianxieMiniEnd`（Web -> Flutter）：运行结束，发送结束信号给宿主

缺少任意信号即视为协议不完整，会导致流程异常（如超时、无法开始、无法结束），并可能导致校验不通过。

## 3. 原生能力请求

> 原生能力请求必须在 `await sdk.sendReady(...)` 成功之后发起。宿主只有收到 ready 信号后才会处理请求；ready 前调用会被拒绝，错误码为 `NX_REQUEST_BEFORE_READY`。

```js
sdk.onInit(async () => {
  await sdk.sendReady({ extras: { stage: "ready" } });
});

sdk.onStart(async () => {
  const profile = await sdk.getUserProfile();
  const image = await sdk.pickImage();
  await sdk.vibrate({ type: "light" });

  const stream = await sdk.requestCameraStream({ facingMode: "environment" });
  document.querySelector("video").srcObject = stream;
});
```

- `requestCameraStream({ facingMode })`：请求实时摄像头流，`user` 为前置，`environment` 为后置。
- `pickImage()`：请求宿主选择单张图片，返回本地文件 URI 与元数据。
- `pickVideo()`：请求宿主选择单个视频，返回本地文件 URI 与元数据。
- `vibrate({ type })`：请求设备震动反馈，`type` 支持 `light`、`medium`、`heavy`、`selection`。
- `getUserProfile()`：请求当前用户公开基础资料，返回 `accountId`、`nickname`、`gender`、`birthday`、`avatarUrl`。

## 4. 检查工具如何使用

在 `package.json` 添加脚本：

```json
{
  "scripts": {
    "nx:package": "npx nianxie-gate package",
    "nx:verify:runtime": "npx nianxie-gate verify-runtime",
    "nx:preflight": "npx nianxie-gate preflight",
    "nx:submit:prepare": "npx nianxie-gate submit-prepare"
  }
}
```

### 推荐执行顺序

```bash
npm run nx:preflight
npm run nx:submit:prepare
```

### 命令说明

- `nx:package`：打包，生成 `dist/` 和 `dist.zip`
- `nx:verify:runtime`：检查协议和运行时问题
- `nx:preflight`：顺序执行 `package + verify`
- `nx:submit:prepare`：生成上传摘要

### 提交前通过标准

- `reports/runtime-verify.json` 中 `ok=true`
- `blockingCount=0`
- 已生成 `dist.zip`
