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
  var pendingInitPayloads = [];
  var pendingStartPayloads = [];
  var hasDeliveredInitToUnity = false;
  var hasDeliveredStartToUnity = false;

  function log() {
    try {
      console.error.apply(console, ["[NxBridge]"].concat([].slice.call(arguments)));
    } catch (_err) {}
  }

  function safeStringify(payload) {
    try {
      return JSON.stringify(payload || {});
    } catch (_err) {
      return "{}";
    }
  }

  function deliverPayloadToUnity(methodName, payloadJson) {
    if (!unityInstanceRef) return false;
    try {
      unityInstanceRef.SendMessage("NianxieBridge", methodName, payloadJson);
      return true;
    } catch (err) {
      log("SendMessage failed", methodName, String(err));
      return false;
    }
  }

  function flushBufferedPayloads() {
    if (!unityInstanceRef) return;

    if (!hasDeliveredInitToUnity && pendingInitPayloads.length > 0) {
      var initPayload = pendingInitPayloads[pendingInitPayloads.length - 1];
      if (deliverPayloadToUnity("OnMiniInit", initPayload)) {
        hasDeliveredInitToUnity = true;
        pendingInitPayloads = [];
        window.__nx_init_payload = null;
        log("OnMiniInit replayed after bindUnityInstance");
      }
    }

    if (!hasDeliveredStartToUnity && pendingStartPayloads.length > 0) {
      var startPayload = pendingStartPayloads[pendingStartPayloads.length - 1];
      if (deliverPayloadToUnity("OnMiniStart", startPayload)) {
        hasDeliveredStartToUnity = true;
        pendingStartPayloads = [];
        window.__nx_start_payload = null;
        log("OnMiniStart replayed after bindUnityInstance");
      }
    }
  }

  window.bindUnityInstance = function (inst) {
    unityInstanceRef = inst;
    flushBufferedPayloads();
  };

  window.__nx_init_payload = null;
  window.__nx_start_payload = null;

  window.OnMiniInit = function (payload) {
    try {
      var s = safeStringify(payload);
      window.__nx_init_payload = s;
      pendingInitPayloads.push(s);
      if (!hasDeliveredInitToUnity && deliverPayloadToUnity("OnMiniInit", s)) {
        hasDeliveredInitToUnity = true;
        pendingInitPayloads = [];
        window.__nx_init_payload = null;
        log("OnMiniInit delivered immediately");
      } else {
        log("OnMiniInit buffered (unity not bound yet)");
      }
    } catch (e) {
      console.error("[NxBridge] OnMiniInit error:", e);
    }
  };

  window.OnMiniStart = function (payload) {
    try {
      var s = safeStringify(payload);
      window.__nx_start_payload = s;
      pendingStartPayloads.push(s);
      if (!hasDeliveredStartToUnity && deliverPayloadToUnity("OnMiniStart", s)) {
        hasDeliveredStartToUnity = true;
        pendingStartPayloads = [];
        window.__nx_start_payload = null;
        log("OnMiniStart delivered immediately");
      } else {
        log("OnMiniStart buffered (unity not bound yet)");
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

  console.error("[NxBridge] bridge ready");
})();
