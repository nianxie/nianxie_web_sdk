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

## 2. 信号量(<span style="color:red;">必须</span>)

信号量是<span style="color:red;">必须</span>实现的协议，不是可选项。  
必须完整走完这 4 个信号：

1. `OnMiniInit`（Flutter -> Web）：收到信号后开始初始化页面(资源、逻辑准备等)
2. `NianxieMiniReady`（Web -> Flutter）：页面准备完成后发送ready信号给宿主，但暂不开始
3. `OnMiniStart`（Flutter -> Web）：收到宿主发来的开始信号，开始正常运行
4. `NianxieMiniEnd`（Web -> Flutter）：运行结束，发送结束信号给宿主

缺少任意信号即视为协议不完整，会导致流程异常（如超时、无法开始、无法结束），并可能导致校验不通过。

## 3. 检查工具如何使用

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

