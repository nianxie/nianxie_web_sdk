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

    public void OnMiniInit(string payloadJson)
    {
        Debug.Log($"[NianxieBridge] OnMiniInit payload={payloadJson}");
        SendReady("{\"stage\":\"assets-loaded\"}");
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
        return NxSendReady(string.IsNullOrWhiteSpace(extrasJson) ? "{}" : extrasJson) == 1;
#else
        Debug.Log("[NianxieBridge] SendReady ignored outside WebGL runtime");
        return false;
#endif
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
