/*!
 * nianxie-interaction-sdk.js
 *
 * Nianxie Interaction SDK
 * - JS -> Flutter: NianxieMiniReady / NianxieMiniEnd / custom handlers
 * - Flutter -> JS: window.OnMiniInit(payload) / window.OnMiniStart(payload)
 *
 * sessionId/itemId/title are auto-managed by SDK context.
 * Web developers do NOT need to manage them manually.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NianxieInteractionSDK = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.2.0';
  var SDK_TAG = '[NianxieInteractionSDK]';
  var CONTEXT_GLOBAL_KEY = '__NianxieMiniContext';
  var CONTEXT_SYNC_FN = 'OnMiniContext';
  var FORBIDDEN_KEYS = { __proto__: true, constructor: true, prototype: true };

  var DEFAULT_REQUEST_MAP = {
    ready: 'NianxieMiniReady',
    end: 'NianxieMiniEnd',
    pickImage: 'NianxiePickImage',
    pickVideo: 'NianxiePickVideo',
    vibrate: 'NianxieVibrate',
    getUserProfile: 'NianxieGetUserProfile',
  };

  var DEFAULTS = {
    protocolVersion: 1,
    source: 'webview',
    initGlobalFunctionName: 'OnMiniInit',
    startGlobalFunctionName: 'OnMiniStart',
    defaultTimeoutMs: 10000,
    strictHandlerCheck: true,
    diagnostics: {
      enabled: false,
      readyTimeoutMs: 8000,
      endTimeoutMs: 120000,
      onEvent: null,
    },
  };

  var DIAGNOSTIC_ERROR = {
    INIT_READY_TIMEOUT: 'NX_DIAG_INIT_READY_TIMEOUT',
    START_END_TIMEOUT: 'NX_DIAG_START_END_TIMEOUT',
    READY_BEFORE_INIT: 'NX_DIAG_READY_BEFORE_INIT',
    END_BEFORE_START: 'NX_DIAG_END_BEFORE_START',
  };

  var SDK_ERROR = {
    REQUEST_BEFORE_READY: 'NX_REQUEST_BEFORE_READY',
    CAMERA_UNAVAILABLE: 'NX_CAMERA_UNAVAILABLE',
  };

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function merge(base, extra) {
    var out = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    }
    if (isObject(extra)) {
      for (key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) out[key] = extra[key];
      }
    }
    return out;
  }

  function hasNonEmptyText(value) {
    return value != null && String(value).trim() !== '';
  }

  function safeCall(fn, payload) {
    if (typeof fn !== 'function') return;
    try {
      fn(payload);
    } catch (_) {}
  }

  function isValidHandlerName(name) {
    if (!hasNonEmptyText(name)) return false;
    return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(String(name));
  }

  function deepSanitize(input, depth) {
    if (depth <= 0) return null;
    if (input == null) return null;
    var inputType = typeof input;
    if (inputType === 'string' || inputType === 'number' || inputType === 'boolean') return input;
    if (input instanceof Date) return input.toISOString();

    if (Array.isArray(input)) {
      var arr = [];
      for (var i = 0; i < input.length; i += 1) arr.push(deepSanitize(input[i], depth - 1));
      return arr;
    }

    if (!isObject(input)) return String(input);

    var out = {};
    var key;
    for (key in input) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      if (FORBIDDEN_KEYS[key]) continue;
      out[key] = deepSanitize(input[key], depth - 1);
    }
    return out;
  }

  function withTimeout(promise, ms, label) {
    if (!(ms > 0)) return promise;
    var timer = null;
    var timeoutPromise = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(new Error(SDK_TAG + ' ' + label + ' timeout after ' + ms + 'ms'));
      }, ms);
    });
    return Promise.race([promise, timeoutPromise]).then(
      function (result) {
        clearTimeout(timer);
        return result;
      },
      function (err) {
        clearTimeout(timer);
        throw err;
      }
    );
  }

  function NianxieInteractionClient(options) {
    this.options = merge(DEFAULTS, options || {});
    this._cleanupTasks = [];
    this._requestMap = merge(DEFAULT_REQUEST_MAP, this.options.requestMap || {});
    this._context = { sessionId: '', itemId: '', title: '' };
    this._diagnostics = this._createDiagnosticsStore();
    this._hydrateContextFromWindow();
  }

  NianxieInteractionClient.prototype._createDiagnosticsStore = function _createDiagnosticsStore() {
    var cfg = this.options.diagnostics || {};
    return {
      enabled: !!cfg.enabled,
      readyTimeoutMs: cfg.readyTimeoutMs > 0 ? cfg.readyTimeoutMs : 8000,
      endTimeoutMs: cfg.endTimeoutMs > 0 ? cfg.endTimeoutMs : 120000,
      onEvent: typeof cfg.onEvent === 'function' ? cfg.onEvent : null,
      events: [],
      timers: {
        readyTimer: null,
        endTimer: null,
      },
      state: {
        initReceived: false,
        readySent: false,
        startReceived: false,
        endSent: false,
      },
    };
  };

  NianxieInteractionClient.prototype._diagnosticEvent = function _diagnosticEvent(event) {
    var store = this._diagnostics;
    if (!store || !store.enabled) return;
    var payload = merge(
      {
        ts: Date.now(),
        level: 'info',
      },
      event || {}
    );
    store.events.push(payload);
    safeCall(store.onEvent, payload);
  };

  NianxieInteractionClient.prototype._diagnosticError = function _diagnosticError(errorCode, phase, suggestion, detail) {
    this._diagnosticEvent({
      level: 'error',
      errorCode: errorCode,
      phase: phase,
      suggestion: suggestion,
      detail: detail || '',
    });
  };

  NianxieInteractionClient.prototype._startDiagnosticTimer = function _startDiagnosticTimer(key, timeoutMs, onTimeout) {
    var store = this._diagnostics;
    if (!store || !store.enabled) return;
    if (store.timers[key]) clearTimeout(store.timers[key]);
    store.timers[key] = setTimeout(function () {
      store.timers[key] = null;
      onTimeout();
    }, timeoutMs);
  };

  NianxieInteractionClient.prototype._clearDiagnosticTimer = function _clearDiagnosticTimer(key) {
    var store = this._diagnostics;
    if (!store || !store.enabled) return;
    if (store.timers[key]) {
      clearTimeout(store.timers[key]);
      store.timers[key] = null;
    }
  };

  NianxieInteractionClient.prototype.getDiagnosticsEvents = function getDiagnosticsEvents() {
    var store = this._diagnostics;
    if (!store) return [];
    return store.events.slice();
  };

  NianxieInteractionClient.prototype.getDiagnosticsState = function getDiagnosticsState() {
    var store = this._diagnostics;
    if (!store) {
      return {
        enabled: false,
        initReceived: false,
        readySent: false,
        startReceived: false,
        endSent: false,
      };
    }
    return {
      enabled: store.enabled,
      initReceived: !!store.state.initReceived,
      readySent: !!store.state.readySent,
      startReceived: !!store.state.startReceived,
      endSent: !!store.state.endSent,
    };
  };

  NianxieInteractionClient.prototype.getVersion = function getVersion() {
    return VERSION;
  };

  NianxieInteractionClient.prototype.isBridgeAvailable = function isBridgeAvailable() {
    return !!(
      typeof window !== 'undefined' &&
      window.flutter_inappwebview &&
      typeof window.flutter_inappwebview.callHandler === 'function'
    );
  };

  NianxieInteractionClient.prototype.waitForBridge = function waitForBridge(options) {
    var cfg = merge({ timeoutMs: 5000, intervalMs: 50 }, options || {});
    var self = this;
    return new Promise(function (resolve) {
      if (self.isBridgeAvailable()) {
        resolve(true);
        return;
      }
      var start = Date.now();
      var timer = setInterval(function () {
        if (self.isBridgeAvailable()) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - start >= cfg.timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, cfg.intervalMs);
    });
  };

  NianxieInteractionClient.prototype.waitForContext = function waitForContext(options) {
    var cfg = merge({ timeoutMs: 5000, intervalMs: 50 }, options || {});
    var self = this;
    return new Promise(function (resolve) {
      self._hydrateContextFromWindow();
      if (self._hasRequiredContext()) {
        resolve(true);
        return;
      }
      var start = Date.now();
      var timer = setInterval(function () {
        self._hydrateContextFromWindow();
        if (self._hasRequiredContext()) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - start >= cfg.timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, cfg.intervalMs);
    });
  };

  NianxieInteractionClient.prototype.getContext = function getContext() {
    return merge({}, this._context);
  };

  NianxieInteractionClient.prototype._hydrateContextFromWindow = function _hydrateContextFromWindow() {
    if (typeof window === 'undefined') return;
    var raw = window[CONTEXT_GLOBAL_KEY];
    if (!isObject(raw)) return;
    this._setContext(raw);
  };

  NianxieInteractionClient.prototype._setContext = function _setContext(payload) {
    if (!isObject(payload)) return;
    if (hasNonEmptyText(payload.sessionId)) this._context.sessionId = String(payload.sessionId);
    if (hasNonEmptyText(payload.itemId)) this._context.itemId = String(payload.itemId);
    if (hasNonEmptyText(payload.title)) this._context.title = String(payload.title);
    if (typeof window !== 'undefined') {
      window[CONTEXT_GLOBAL_KEY] = merge({}, this._context);
    }
  };

  NianxieInteractionClient.prototype._hasRequiredContext = function _hasRequiredContext() {
    return hasNonEmptyText(this._context.sessionId) && hasNonEmptyText(this._context.itemId);
  };

  NianxieInteractionClient.prototype._getRequiredContext = function _getRequiredContext() {
    this._hydrateContextFromWindow();
    if (!this._hasRequiredContext()) {
      throw new Error(
        SDK_TAG +
          ' Missing context. Wait for OnMiniInit/OnMiniContext before sending requests.'
      );
    }
    return this._context;
  };

  NianxieInteractionClient.prototype._callHandler = function _callHandler(handlerName, payload, options) {
    var cfg = merge({ timeoutMs: this.options.defaultTimeoutMs }, options || {});
    if (!this.isBridgeAvailable()) {
      return Promise.reject(
        new Error(SDK_TAG + ' Bridge unavailable. Must run inside Flutter InAppWebView.')
      );
    }
    if (this.options.strictHandlerCheck && !isValidHandlerName(handlerName)) {
      return Promise.reject(new Error(SDK_TAG + ' Invalid handler name: ' + String(handlerName)));
    }
    var sanitizedPayload = deepSanitize(payload, 12);
    var task = window.flutter_inappwebview.callHandler(handlerName, sanitizedPayload);
    return withTimeout(task, cfg.timeoutMs, 'callHandler(' + handlerName + ')');
  };

  NianxieInteractionClient.prototype.registerRequest = function registerRequest(name, handlerName) {
    if (!hasNonEmptyText(name)) {
      throw new Error(SDK_TAG + ' registerRequest(name, handler) requires non-empty name.');
    }
    if (!isValidHandlerName(handlerName)) {
      throw new Error(SDK_TAG + ' registerRequest invalid handler: ' + String(handlerName));
    }
    this._requestMap[String(name)] = String(handlerName);
    return this;
  };

  NianxieInteractionClient.prototype.registerRequests = function registerRequests(map) {
    if (!isObject(map)) return this;
    var key;
    for (key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
      this.registerRequest(key, map[key]);
    }
    return this;
  };

  NianxieInteractionClient.prototype.getRegisteredRequests = function getRegisteredRequests() {
    return merge({}, this._requestMap);
  };

  NianxieInteractionClient.prototype._isReadySent = function _isReadySent() {
    return !!(this._diagnostics && this._diagnostics.state && this._diagnostics.state.readySent);
  };

  NianxieInteractionClient.prototype._createSdkError = function _createSdkError(errorCode, message) {
    var error = new Error(SDK_TAG + ' ' + message);
    error.errorCode = errorCode;
    return error;
  };

  NianxieInteractionClient.prototype._assertReadyForCapability = function _assertReadyForCapability(capability) {
    if (this._isReadySent()) return;
    throw this._createSdkError(
      SDK_ERROR.REQUEST_BEFORE_READY,
      String(capability || 'capability') + ' requires sendReady() to complete first.'
    );
  };

  NianxieInteractionClient.prototype.buildPayload = function buildPayload(eventId, params) {
    var p = params || {};
    var ctx = this._getRequiredContext();
    var payload = {
      protocolVersion: this.options.protocolVersion,
      eventId: String(eventId || '').trim(),
      sessionId: ctx.sessionId,
      itemId: ctx.itemId,
      title: ctx.title || '',
      source: p.source || this.options.source,
      ts: Date.now(),
    };
    if (isObject(p.extras) && Object.keys(p.extras).length > 0) {
      payload.extras = deepSanitize(p.extras, 12);
    }
    return payload;
  };

  NianxieInteractionClient.prototype.request = function request(name, params, options) {
    var requestName = String(name || '').trim();
    if (!requestName) {
      return Promise.reject(new Error(SDK_TAG + ' request(name, ...) requires request name.'));
    }
    var handlerName = this._requestMap[requestName];
    if (!handlerName) {
      return Promise.reject(
        new Error(SDK_TAG + ' Unknown request "' + requestName + '". Register it first.')
      );
    }
    var payload;
    try {
      payload = this.buildPayload(requestName, params || {});
    } catch (e) {
      return Promise.reject(e);
    }
    return this._callHandler(handlerName, payload, options || {});
  };

  NianxieInteractionClient.prototype.sendReady = function sendReady(params, options) {
    var payload;
    var store = this._diagnostics;
    if (store && store.enabled && !store.state.initReceived) {
      this._diagnosticError(
        DIAGNOSTIC_ERROR.READY_BEFORE_INIT,
        'ready',
        '请先等待 OnMiniInit 回调后再发送 ready',
        'sendReady called before init callback'
      );
    }
    try {
      payload = this.buildPayload('interaction_ready', params || {});
    } catch (e) {
      return Promise.reject(e);
    }
    var self = this;
    return this._callHandler(this._requestMap.ready, payload, options || {}).then(function (res) {
      if (store && store.state) {
        store.state.readySent = true;
      }
      if (store && store.enabled) {
        self._clearDiagnosticTimer('readyTimer');
        self._diagnosticEvent({ phase: 'ready', eventId: 'interaction_ready', detail: 'ready sent' });
      }
      return res;
    });
  };

  NianxieInteractionClient.prototype.pickImage = function pickImage(options) {
    try {
      this._assertReadyForCapability('pickImage');
    } catch (e) {
      return Promise.reject(e);
    }
    return this.request('pickImage', { extras: options || {} }, options || {});
  };

  NianxieInteractionClient.prototype.pickVideo = function pickVideo(options) {
    try {
      this._assertReadyForCapability('pickVideo');
    } catch (e) {
      return Promise.reject(e);
    }
    return this.request('pickVideo', { extras: options || {} }, options || {});
  };

  NianxieInteractionClient.prototype.vibrate = function vibrate(options) {
    try {
      this._assertReadyForCapability('vibrate');
    } catch (e) {
      return Promise.reject(e);
    }
    return this.request('vibrate', { extras: options || {} }, options || {});
  };

  NianxieInteractionClient.prototype.getUserProfile = function getUserProfile(options) {
    try {
      this._assertReadyForCapability('getUserProfile');
    } catch (e) {
      return Promise.reject(e);
    }
    return this.request('getUserProfile', { extras: {} }, options || {});
  };

  NianxieInteractionClient.prototype.requestCameraStream = function requestCameraStream(options) {
    try {
      this._assertReadyForCapability('requestCameraStream');
    } catch (e) {
      return Promise.reject(e);
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      return Promise.reject(
        this._createSdkError(
          SDK_ERROR.CAMERA_UNAVAILABLE,
          'navigator.mediaDevices.getUserMedia is unavailable.'
        )
      );
    }
    var cfg = options || {};
    var facingMode = cfg.facingMode === 'environment' ? 'environment' : 'user';
    var constraints = {
      audio: false,
      video: { facingMode: facingMode },
    };
    if (typeof console !== 'undefined' && console && typeof console.debug === 'function') {
      console.debug(SDK_TAG + ' requestCameraStream', constraints);
    }
    return navigator.mediaDevices.getUserMedia(constraints).then(
      function (stream) {
        if (typeof console !== 'undefined' && console && typeof console.debug === 'function') {
          var tracks = stream && typeof stream.getVideoTracks === 'function'
            ? stream.getVideoTracks().length
            : 0;
          console.debug(SDK_TAG + ' requestCameraStream success videoTracks=' + tracks);
        }
        return stream;
      },
      function (error) {
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
          console.error(SDK_TAG + ' requestCameraStream failed', error);
        }
        throw error;
      }
    );
  };

  NianxieInteractionClient.prototype.sendEnd = function sendEnd(params, options) {
    var payload;
    var store = this._diagnostics;
    if (store && store.enabled && !store.state.startReceived) {
      this._diagnosticError(
        DIAGNOSTIC_ERROR.END_BEFORE_START,
        'end',
        '请先等待 OnMiniStart 回调后再发送 end',
        'sendEnd called before start callback'
      );
    }
    try {
      payload = this.buildPayload('interaction_end', params || {});
    } catch (e) {
      return Promise.reject(e);
    }
    var self = this;
    return this._callHandler(this._requestMap.end, payload, options || {}).then(function (res) {
      if (store && store.enabled) {
        store.state.endSent = true;
        self._clearDiagnosticTimer('endTimer');
        self._diagnosticEvent({ phase: 'end', eventId: 'interaction_end', detail: 'end sent' });
      }
      return res;
    });
  };

  NianxieInteractionClient.prototype.onInit = function onInit(callback) {
    if (typeof window === 'undefined') return function noop() {};
    if (typeof callback !== 'function') {
      throw new Error(SDK_TAG + ' onInit(callback) requires function callback.');
    }

    var self = this;
    var fnName = this.options.initGlobalFunctionName;
    var previousFn = window[fnName];
    var previousCtxFn = window[CONTEXT_SYNC_FN];

    window[CONTEXT_SYNC_FN] = function (payload) {
      self._setContext(payload || {});
      if (typeof previousCtxFn === 'function') {
        try {
          previousCtxFn(payload);
        } catch (_) {}
      }
    };

    window[fnName] = function (payload) {
      var safePayload = deepSanitize(payload, 12);
      self._setContext(safePayload || {});
      if (self._diagnostics && self._diagnostics.enabled) {
        self._diagnostics.state.initReceived = true;
        self._diagnosticEvent({ phase: 'init', eventId: 'interaction_init', detail: 'init received' });
        self._startDiagnosticTimer('readyTimer', self._diagnostics.readyTimeoutMs, function () {
          self._diagnosticError(
            DIAGNOSTIC_ERROR.INIT_READY_TIMEOUT,
            'ready',
            '请在 OnMiniInit 完成资源准备后调用 sdk.sendReady()',
            'ready not sent after init'
          );
        });
      }
      callback(safePayload);
      if (typeof previousFn === 'function') {
        try {
          previousFn(payload);
        } catch (_) {}
      }
    };

    this._hydrateContextFromWindow();

    var disposed = false;
    var cleanup = function () {
      if (disposed) return;
      disposed = true;
      if (window[fnName] && window[fnName] !== previousFn) window[fnName] = previousFn;
      if (window[CONTEXT_SYNC_FN] && window[CONTEXT_SYNC_FN] !== previousCtxFn) {
        window[CONTEXT_SYNC_FN] = previousCtxFn;
      }
    };
    this._cleanupTasks.push(cleanup);
    return cleanup;
  };

  NianxieInteractionClient.prototype.onStart = function onStart(callback) {
    if (typeof window === 'undefined') return function noop() {};
    if (typeof callback !== 'function') {
      throw new Error(SDK_TAG + ' onStart(callback) requires function callback.');
    }

    var self = this;
    var fnName = this.options.startGlobalFunctionName;
    var previousFn = window[fnName];
    var previousCtxFn = window[CONTEXT_SYNC_FN];

    window[CONTEXT_SYNC_FN] = function (payload) {
      self._setContext(payload || {});
      if (typeof previousCtxFn === 'function') {
        try {
          previousCtxFn(payload);
        } catch (_) {}
      }
    };

    window[fnName] = function (payload) {
      var safePayload = deepSanitize(payload, 12);
      self._setContext(safePayload || {});
      if (self._diagnostics && self._diagnostics.enabled) {
        self._diagnostics.state.startReceived = true;
        self._diagnosticEvent({ phase: 'start', eventId: 'interaction_start', detail: 'start received' });
        self._startDiagnosticTimer('endTimer', self._diagnostics.endTimeoutMs, function () {
          self._diagnosticError(
            DIAGNOSTIC_ERROR.START_END_TIMEOUT,
            'end',
            '请在交互结束时调用 sdk.sendEnd() 并确保可达结束路径',
            'end not sent after start'
          );
        });
      }
      callback(safePayload);
      if (typeof previousFn === 'function') {
        try {
          previousFn(payload);
        } catch (_) {}
      }
    };

    this._hydrateContextFromWindow();

    var disposed = false;
    var cleanup = function () {
      if (disposed) return;
      disposed = true;
      if (window[fnName] && window[fnName] !== previousFn) window[fnName] = previousFn;
      if (window[CONTEXT_SYNC_FN] && window[CONTEXT_SYNC_FN] !== previousCtxFn) {
        window[CONTEXT_SYNC_FN] = previousCtxFn;
      }
    };
    this._cleanupTasks.push(cleanup);
    return cleanup;
  };

  NianxieInteractionClient.prototype.mount = function mount(config) {
    var cfg = config || {};
    var offInit = typeof cfg.onInit === 'function' ? this.onInit(cfg.onInit) : function noop() {};
    var offStart = typeof cfg.onStart === 'function' ? this.onStart(cfg.onStart) : function noop() {};
    return function cleanup() {
      offInit();
      offStart();
    };
  };

  NianxieInteractionClient.prototype.destroy = function destroy() {
    this._clearDiagnosticTimer('readyTimer');
    this._clearDiagnosticTimer('endTimer');
    while (this._cleanupTasks.length > 0) {
      var task = this._cleanupTasks.pop();
      try {
        task();
      } catch (_) {}
    }
  };

  function createNianxieInteractionSDK(options) {
    return new NianxieInteractionClient(options);
  }

  return {
    version: VERSION,
    diagnosticErrorCodes: merge({}, DIAGNOSTIC_ERROR),
    errorCodes: merge({}, SDK_ERROR),
    NianxieInteractionClient: NianxieInteractionClient,
    createNianxieInteractionSDK: createNianxieInteractionSDK,
  };
});
