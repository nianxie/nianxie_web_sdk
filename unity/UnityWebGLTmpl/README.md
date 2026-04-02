# Unity WebGL Template Quickstart

This folder is a copy-ready Unity integration starter for Nianxie WebSDK.

## Included files

- `Assets/WebGLTemplates/NianxieTemplate/index.html`
- `Assets/WebGLTemplates/NianxieTemplate/nianxie-interaction-sdk.js`
- `Assets/WebGLTemplates/NianxieTemplate/nianxie-web-bridge.js`
- `Assets/Plugins/WebGL/nianxie_bridge.jslib`
- `Assets/Scripts/NianxieBridge.cs`
- `tools/nianxie-gate.js`
- `tools/nx-verify-runtime.js`
- `tools/local-host-simulator.js`
- `tools/nx-common.js`
- `error-codes.json`

## How to use

1. Copy `unity/UnityWebGLTmpl/Assets/*` into your Unity project `Assets/`.
2. Open Unity and set:
   - `Project Settings -> Player -> WebGL -> Resolution and Presentation -> WebGL Template`
   - Choose `NianxieTemplate`.
3. Create a GameObject named `NianxieBridge` and attach `NianxieBridge.cs`.
4. Build WebGL and test in host environment.

## Local runtime checks (recommended)

Run in your exported web project root (must contain `dist/`):

```bash
node tools/nx-verify-runtime.js
node tools/local-host-simulator.js
```

or via gate entry:

```bash
node tools/nianxie-gate.js verify-runtime
node tools/nianxie-gate.js simulate-host
```

Reports:

- `reports/runtime-verify.json`
- `reports/local-host-simulator.json`

## Runtime flow

1. Host sends `OnMiniInit(payload)` to JS.
2. Bridge forwards payload into Unity and caches it for polling.
3. Unity sends `NxSendReady(...)` when assets are ready.
4. Host sends `OnMiniStart(payload)` and gameplay starts.
5. Unity sends `NxSendEnd(...)` on completion.

## Notes

- `NianxieBridge.cs` auto-sends `ready` in `OnMiniInit` as a starter behavior.
- Replace starter behavior with your own asset-load completion condition.
- Keep script names unchanged unless you also update the corresponding bridge calls.
