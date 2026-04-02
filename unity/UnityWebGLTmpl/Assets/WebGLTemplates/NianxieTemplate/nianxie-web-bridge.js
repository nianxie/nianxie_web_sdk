(function () {
  if (!window.NianxieInteractionSDK) {
    console.error("[NxBridge] NianxieInteractionSDK not found");
    return;
  }

  var nxSdk = window.NianxieInteractionSDK.createNianxieInteractionSDK({
    source: "webview",
    defaultTimeoutMs: 10000,
  });

  var unityInstanceRef = null;
  window.bindUnityInstance = function (inst) {
    unityInstanceRef = inst;
  };

  window.__nx_init_payload = null;
  window.__nx_start_payload = null;

  window.OnMiniInit = function (payload) {
    try {
      var s = JSON.stringify(payload || {});
      window.__nx_init_payload = s;
      if (unityInstanceRef) {
        unityInstanceRef.SendMessage("NianxieBridge", "OnMiniInit", s);
      }
    } catch (e) {
      console.error("[NxBridge] OnMiniInit error:", e);
    }
  };

  window.OnMiniStart = function (payload) {
    try {
      var s = JSON.stringify(payload || {});
      window.__nx_start_payload = s;
      if (unityInstanceRef) {
        unityInstanceRef.SendMessage("NianxieBridge", "OnMiniStart", s);
      }
    } catch (e) {
      console.error("[NxBridge] OnMiniStart error:", e);
    }
  };

  window.NxSendReady = async function (extrasJson) {
    try {
      var extras = extrasJson ? JSON.parse(extrasJson) : {};
      return await nxSdk.sendReady({ extras: extras });
    } catch (e) {
      console.error("[NxBridge] NxSendReady error:", e);
      return { ok: false, error: String(e) };
    }
  };

  window.NxSendEnd = async function (extrasJson) {
    try {
      var extras = extrasJson ? JSON.parse(extrasJson) : {};
      return await nxSdk.sendEnd({ extras: extras });
    } catch (e) {
      console.error("[NxBridge] NxSendEnd error:", e);
      return { ok: false, error: String(e) };
    }
  };

  window.NxDebugGetContext = function () {
    try {
      return nxSdk.getContext();
    } catch (_) {
      return null;
    }
  };

  console.log("[NxBridge] bridge ready");
})();
