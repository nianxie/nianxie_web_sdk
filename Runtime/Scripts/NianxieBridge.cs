using System;
using System.Collections;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using UnityEngine;

[DefaultExecutionOrder(-10000)]
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
    [SerializeField] private bool autoPrelaunchOnInit = true;
    [SerializeField] private int prelaunchStageId = 0;
    [SerializeField] private int prelaunchCharacterId = 0;
    [SerializeField] private bool prelaunchResetStageData = true;
    [SerializeField] private bool pauseAfterPrelaunch = true;
    [SerializeField] private bool resumeOnStart = true;
    [SerializeField] private bool autoSendReadyAfterPrelaunch = true;
    [SerializeField] private float readyDelaySeconds = 0.15f;
    [SerializeField] private string readyStageTag = "game-paused-await-start";
    [SerializeField] private bool applyTopSafeOffset = true;
    [SerializeField] private float topSafeExtraOffsetPx = 150f;

    private bool hasReceivedInit;
    private bool hasSentReady;
    private static NianxieBridge instance;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void AutoBootstrap()
    {
        if (instance != null) return;
        var existing = UnityEngine.Object.FindObjectsOfType<NianxieBridge>(true)
            .FirstOrDefault();
        if (existing != null)
        {
            instance = existing;
            DontDestroyOnLoad(existing.gameObject);
            return;
        }

        var go = new GameObject("NianxieBridge");
        DontDestroyOnLoad(go);
        instance = go.AddComponent<NianxieBridge>();
    }

    private void Awake()
    {
        if (instance != null && instance != this)
        {
            Destroy(gameObject);
            return;
        }

        instance = this;
        gameObject.name = "NianxieBridge";
        DontDestroyOnLoad(gameObject);
    }

    public void OnMiniInit(string payloadJson)
    {
        Debug.Log($"[NianxieBridge] OnMiniInit payload={payloadJson}");
        hasReceivedInit = true;
        hasSentReady = false;

        if (autoPrelaunchOnInit)
        {
            TryPrelaunchGame();
        }
        if (pauseAfterPrelaunch)
        {
            Time.timeScale = 0f;
        }
        if (applyTopSafeOffset)
        {
            StartCoroutine(ApplyTopSafeOffsetAfterFrame());
        }
        if (autoSendReadyAfterPrelaunch)
        {
            StartCoroutine(SendReadyAfterDelay());
        }
    }

    public void OnMiniStart(string payloadJson)
    {
        Debug.Log($"[NianxieBridge] OnMiniStart payload={payloadJson}");
        if (resumeOnStart)
        {
            Time.timeScale = 1f;
        }
        if (applyTopSafeOffset)
        {
            StartCoroutine(ApplyTopSafeOffsetAfterFrame());
        }
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

        var safeStage = string.IsNullOrWhiteSpace(stageTag) ? "game-paused-await-start" : stageTag;
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

    private IEnumerator SendReadyAfterDelay()
    {
        if (readyDelaySeconds > 0f)
        {
            yield return new WaitForSecondsRealtime(readyDelaySeconds);
        }
        TrySendReady(readyStageTag);
    }

    private bool TryPrelaunchGame()
    {
        var gameControllerType = AppDomain.CurrentDomain
            .GetAssemblies()
            .SelectMany(assembly =>
            {
                try
                {
                    return assembly.GetTypes();
                }
                catch (ReflectionTypeLoadException e)
                {
                    return e.Types.Where(t => t != null);
                }
            })
            .FirstOrDefault(t => t != null && t.FullName == "OctoberStudio.GameController");

        if (gameControllerType == null)
        {
            Debug.LogWarning("[NianxieBridge] GameController not found, skip prelaunch.");
            return false;
        }

        var startGameDirect = gameControllerType.GetMethod(
            "StartGameDirect",
            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

        if (startGameDirect == null)
        {
            Debug.LogWarning("[NianxieBridge] StartGameDirect not found, skip prelaunch.");
            return false;
        }

        try
        {
            startGameDirect.Invoke(null, new object[]
            {
                prelaunchStageId,
                prelaunchCharacterId,
                prelaunchResetStageData,
            });
            Debug.Log("[NianxieBridge] Prelaunch dispatched.");
            return true;
        }
        catch (Exception ex)
        {
            Debug.LogError("[NianxieBridge] Prelaunch failed: " + ex.Message);
            return false;
        }
    }

    private IEnumerator ApplyTopSafeOffsetAfterFrame()
    {
        yield return null;
        try
        {
            var gameScreenType = AppDomain.CurrentDomain
                .GetAssemblies()
                .SelectMany(assembly =>
                {
                    try
                    {
                        return assembly.GetTypes();
                    }
                    catch (ReflectionTypeLoadException e)
                    {
                        return e.Types.Where(t => t != null);
                    }
                })
                .FirstOrDefault(t => t != null && t.FullName == "OctoberStudio.GameScreenBehavior");

            if (gameScreenType == null) yield break;

            var all = UnityEngine.Object.FindObjectsOfType(gameScreenType);
            if (all == null || all.Length == 0) yield break;

            var topUiField = gameScreenType.GetField("topUI",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (topUiField == null) yield break;

            var topInsetPx = Mathf.Max(0f, Screen.height - Screen.safeArea.yMax);
            var offset = topInsetPx + Mathf.Max(0f, topSafeExtraOffsetPx);

            foreach (var item in all)
            {
                var canvasGroup = topUiField.GetValue(item) as CanvasGroup;
                if (canvasGroup == null) continue;
                var rect = canvasGroup.GetComponent<RectTransform>();
                if (rect == null) continue;
                var p = rect.anchoredPosition;
                rect.anchoredPosition = new Vector2(p.x, -Mathf.Abs(offset));
            }
        }
        catch (Exception ex)
        {
            Debug.LogWarning("[NianxieBridge] ApplyTopSafeOffset failed: " + ex.Message);
        }
    }
}
