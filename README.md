# Nianxie WebSDK 标准文档（Unity 版）

---

## 第一部分：信号说明

### 1) 标准四段式时序（必须）

> ⚠️ 必须完整走完：`init -> ready -> start -> end`

1. Host -> WebGL：`window.OnMiniInit(payload)`（`interaction_init`）
2. WebGL -> Host：`NianxieMiniReady`（`interaction_ready`）
3. Host -> WebGL：`window.OnMiniStart(payload)`（`interaction_start`）
4. WebGL -> Host：`NianxieMiniEnd`（`interaction_end`）

缺少任意一步都视为协议不完整，可能导致超时、无法开始、无法结束。

## 常见错误速查

- `Unable to locate a valid Unity runtime path`
  - 常见原因：目录层级错误或资源命中 HTML 回退页
  - 先检查 ZIP 是否根目录直出 `index.html + Build/`
- `Unable to parse config JSON: Invalid value`
  - 常见原因：读到非法 JSON（HTML 或空值）
  - 确保根目录 `config.json` 存在且可正常读取

