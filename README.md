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
  await sdk.saveImage({
    dataUrl: document.querySelector("canvas").toDataURL("image/png"),
    fileName: "result.png",
    album: "Nianxie",
  });
  await sdk.vibrate({ type: "light" });

  const stream = await sdk.requestCameraStream({ facingMode: "environment" });
  document.querySelector("video").srcObject = stream;
});
```

- `requestCameraStream({ facingMode })`：请求实时摄像头流，`user` 为前置，`environment` 为后置。
- `pickImage()`：请求宿主选择单张图片，返回本地文件 URI 与元数据。
- `pickVideo()`：请求宿主选择单个视频，返回本地文件 URI 与元数据。
- `saveImage(options)`：请求宿主将图片保存到系统相册。
- `vibrate({ type })`：请求设备震动反馈，`type` 支持 `light`、`medium`、`heavy`、`selection`。
- `getUserProfile()`：请求当前用户公开基础资料，返回 `accountId`、`nickname`、`gender`、`birthday`、`avatarUrl`。

### 保存图片

`saveImage` 必须在 `sendReady` 成功之后调用。推荐在用户点击“保存”按钮时调用，以便宿主弹出相册写入授权。

```js
// 保存 canvas 截图
const result = await sdk.saveImage({
  dataUrl: canvas.toDataURL("image/png"),
  fileName: "score-card.png",
  album: "Nianxie",
});

if (!result.ok) {
  console.warn(result.errorCode, result.error);
}
```

也可以保存远程图片、本地 URI 或原始 base64：

```js
await sdk.saveImage({ url: "https://example.com/image.png", fileName: "image.png" });
await sdk.saveImage({ uri: "file:///tmp/image.jpg" });
await sdk.saveImage({ base64, mimeType: "image/png", fileName: "image.png" });
```

参数说明：

- `dataUrl`：base64 data URL，例如 `canvas.toDataURL("image/png")`。
- `base64` + `mimeType`：原始 base64 图片数据。
- `url` / `uri` / `path`：远程图片地址、本地文件 URI 或本地路径，三者任选其一。
- `fileName`：保存时使用的文件名，建议包含 `.png`、`.jpg`、`.webp` 等扩展名。
- `album`：可选，相册名称。
- `maxBytes`：可选，宿主下载或解码的最大字节数，默认 25 MiB。

返回值：

```js
// 成功
{ ok: true, uri: "file:///...", path: "/...", album: "Nianxie" }

// 失败
{ ok: false, errorCode: "NX_SAVE_IMAGE_FAILED", error: "..." }
```

常见错误码：

- `NX_REQUEST_BEFORE_READY`：未在 `sendReady` 成功之后调用。
- `NX_SAVE_IMAGE_INVALID_INPUT`：未提供有效图片来源，或图片数据格式不正确。
- `NX_SAVE_IMAGE_PERMISSION_DENIED`：用户未授予相册写入权限。
- `NX_SAVE_IMAGE_FAILED`：宿主保存失败，例如下载失败、图片格式不支持或系统相册写入失败。

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
