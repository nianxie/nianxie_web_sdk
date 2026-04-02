/**
 * Nianxie Interaction SDK - TypeScript declarations
 */

export interface NianxieSDKOptions {
  protocolVersion?: number;
  source?: string;
  initGlobalFunctionName?: string;
  startGlobalFunctionName?: string;
  defaultTimeoutMs?: number;
  strictHandlerCheck?: boolean;
  requestMap?: Record<string, string>;
  diagnostics?: DiagnosticsOptions;
}

export interface DiagnosticsOptions {
  enabled?: boolean;
  readyTimeoutMs?: number;
  endTimeoutMs?: number;
  onEvent?: (event: DiagnosticEvent) => void;
}

export interface DiagnosticEvent {
  ts: number;
  level: 'info' | 'error';
  phase?: 'init' | 'ready' | 'start' | 'end';
  eventId?: string;
  errorCode?: string;
  suggestion?: string;
  detail?: string;
}

export interface MiniContext {
  sessionId: string;
  itemId: string;
  title: string;
}

/**
 * SDK auto-manages sessionId/itemId/title from Flutter context.
 * Developers should only pass business extras.
 */
export interface PayloadParams {
  source?: string;
  extras?: Record<string, unknown>;
}

export interface RequestOptions {
  timeoutMs?: number;
}

export interface ProtocolPayload {
  protocolVersion: number;
  eventId: string;
  source: string;
  ts: number;
  sessionId: string;
  itemId: string;
  title: string;
  extras?: Record<string, unknown>;
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export interface MountConfig {
  onInit?: (payload: ProtocolPayload) => void;
  onStart?: (payload: ProtocolPayload) => void;
}

export declare class NianxieInteractionClient {
  constructor(options?: NianxieSDKOptions);

  getVersion(): string;
  isBridgeAvailable(): boolean;
  waitForBridge(options?: WaitOptions): Promise<boolean>;

  /** Wait until SDK gets required context from Flutter (sessionId/itemId). */
  waitForContext(options?: WaitOptions): Promise<boolean>;

  /** Get current auto-managed context snapshot. */
  getContext(): MiniContext;

  buildPayload(eventId: string, params?: PayloadParams): ProtocolPayload;

  registerRequest(name: string, handlerName: string): this;
  registerRequests(map: Record<string, string>): this;
  getRegisteredRequests(): Record<string, string>;

  request<T = unknown>(name: string, params?: PayloadParams, options?: RequestOptions): Promise<T>;
  sendReady<T = unknown>(params?: PayloadParams, options?: RequestOptions): Promise<T>;
  sendEnd<T = unknown>(params?: PayloadParams, options?: RequestOptions): Promise<T>;

  /** Listen for Flutter init signal (window.OnMiniInit). */
  onInit(callback: (payload: ProtocolPayload) => void): () => void;
  /** Listen for Flutter start signal (window.OnMiniStart). */
  onStart(callback: (payload: ProtocolPayload) => void): () => void;
  /** Shorthand for registering onInit/onStart callbacks together. */
  mount(config: MountConfig): () => void;
  getDiagnosticsEvents(): DiagnosticEvent[];
  getDiagnosticsState(): {
    enabled: boolean;
    initReceived: boolean;
    readySent: boolean;
    startReceived: boolean;
    endSent: boolean;
  };
  destroy(): void;
}

export declare function createNianxieInteractionSDK(options?: NianxieSDKOptions): NianxieInteractionClient;
export declare const version: string;
export declare const diagnosticErrorCodes: {
  INIT_READY_TIMEOUT: string;
  START_END_TIMEOUT: string;
  READY_BEFORE_INIT: string;
  END_BEFORE_START: string;
};

declare const NianxieInteractionSDK: {
  version: string;
  diagnosticErrorCodes: typeof diagnosticErrorCodes;
  NianxieInteractionClient: typeof NianxieInteractionClient;
  createNianxieInteractionSDK: typeof createNianxieInteractionSDK;
};

export default NianxieInteractionSDK;

declare global {
  interface Window {
    NianxieInteractionSDK: typeof NianxieInteractionSDK;
    OnMiniInit?: (payload: ProtocolPayload) => void;
    OnMiniStart?: (payload: ProtocolPayload) => void;
    OnMiniContext?: (payload: Partial<ProtocolPayload>) => void;
    __NianxieMiniContext?: Partial<MiniContext>;
  }
}
