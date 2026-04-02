mergeInto(LibraryManager.library, {
  NxSendReady: function (extrasJsonPtr) {
    try {
      var extrasJson = UTF8ToString(extrasJsonPtr || 0);
      if (typeof window.NxSendReady === "function") {
        window.NxSendReady(extrasJson || "{}");
        return 1;
      }
      console.error("[NxBridge] window.NxSendReady not found");
      return 0;
    } catch (e) {
      console.error("[NxBridge] NxSendReady error:", e);
      return 0;
    }
  },

  NxSendEnd: function (extrasJsonPtr) {
    try {
      var extrasJson = UTF8ToString(extrasJsonPtr || 0);
      if (typeof window.NxSendEnd === "function") {
        window.NxSendEnd(extrasJson || "{}");
        return 1;
      }
      console.error("[NxBridge] window.NxSendEnd not found");
      return 0;
    } catch (e) {
      console.error("[NxBridge] NxSendEnd error:", e);
      return 0;
    }
  },

  NxPopInitPayload: function () {
    try {
      var s = window.__nx_init_payload;
      if (!s) return 0;
      window.__nx_init_payload = null;
      var len = lengthBytesUTF8(s) + 1;
      var ptr = _malloc(len);
      stringToUTF8(s, ptr, len);
      return ptr;
    } catch (e) {
      console.error("[NxBridge] NxPopInitPayload error:", e);
      return 0;
    }
  },

  NxPopStartPayload: function () {
    try {
      var s = window.__nx_start_payload;
      if (!s) return 0;
      window.__nx_start_payload = null;
      var len = lengthBytesUTF8(s) + 1;
      var ptr = _malloc(len);
      stringToUTF8(s, ptr, len);
      return ptr;
    } catch (e) {
      console.error("[NxBridge] NxPopStartPayload error:", e);
      return 0;
    }
  },

  NxFreeString: function (ptr) {
    if (ptr) _free(ptr);
  },
});
