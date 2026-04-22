using System;
using System.Runtime.InteropServices;
using UnityEngine;

public class NianxieBridge : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] private static extern int NxSendReady(string extrasJson);
    [DllImport("__Internal")] private static extern int NxSendEnd(string extrasJson);
    [DllImport("__Internal")] private static extern IntPtr NxPopInitPayload();
    [DllImport("__Internal")] private static extern IntPtr NxPopStartPayload();
    [DllImport("__Internal")] private static extern void NxFreeString(IntPtr ptr);
#endif

    [SerializeField] private bool pollPayloadFromJs = true;
    [SerializeField] private bool autoSendReadyOnInit = false;
    [SerializeField] private string readyStageTag = "main-menu-visible";

    private bool hasReceivedInit;
    private bool hasSentReady;

    public void OnMiniInit(string payloadJson)
    {
        Debug.Log($"[NianxieBridge] OnMiniInit payload={payloadJson}");
        hasReceivedInit = true;
        if (autoSendReadyOnInit)
        {
            TrySendReady(readyStageTag);
        }
    }

    public void OnMiniStart(string payloadJson)
    {
        Debug.Log($"[NianxieBridge] OnMiniStart payload={payloadJson}");
    }

    public void FinishInteraction()
    {
        SendEnd("{\"result\":\"success\"}");
    }

    public bool SendReady(string extrasJson = "{}")
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        var ok = NxSendReady(string.IsNullOrWhiteSpace(extrasJson) ? "{}" : extrasJson) == 1;
        if (ok) hasSentReady = true;
        return ok;
#else
        Debug.Log("[NianxieBridge] SendReady ignored outside WebGL runtime");
        return false;
#endif
    }

    /// <summary>
    /// Call this when your home/menu is fully visible and ready for host start.
    /// </summary>
    public bool NotifyHomeReady()
    {
        return TrySendReady(readyStageTag);
    }

    private bool TrySendReady(string stageTag)
    {
        if (hasSentReady) return true;
        if (!hasReceivedInit)
        {
            Debug.LogWarning("[NianxieBridge] NotifyHomeReady ignored: init payload not received.");
            return false;
        }

        var safeStage = string.IsNullOrWhiteSpace(stageTag) ? "main-menu-visible" : stageTag;
        return SendReady("{\"stage\":\"" + safeStage + "\"}");
    }

    public bool SendEnd(string extrasJson = "{}")
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return NxSendEnd(string.IsNullOrWhiteSpace(extrasJson) ? "{}" : extrasJson) == 1;
#else
        Debug.Log("[NianxieBridge] SendEnd ignored outside WebGL runtime");
        return false;
#endif
    }

    private void Update()
    {
        if (!pollPayloadFromJs) return;
#if UNITY_WEBGL && !UNITY_EDITOR
        PumpInitPayload();
        PumpStartPayload();
#endif
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    private void PumpInitPayload()
    {
        var ptr = NxPopInitPayload();
        if (ptr == IntPtr.Zero) return;
        try
        {
            var payload = Marshal.PtrToStringAnsi(ptr) ?? "{}";
            OnMiniInit(payload);
        }
        finally
        {
            NxFreeString(ptr);
        }
    }

    private void PumpStartPayload()
    {
        var ptr = NxPopStartPayload();
        if (ptr == IntPtr.Zero) return;
        try
        {
            var payload = Marshal.PtrToStringAnsi(ptr) ?? "{}";
            OnMiniStart(payload);
        }
        finally
        {
            NxFreeString(ptr);
        }
    }
#endif
}
