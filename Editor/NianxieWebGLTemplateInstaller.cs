using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.Build;
using UnityEngine;

[InitializeOnLoad]
public static class NianxieWebGLTemplateInstaller
{
    private const string MenuInstall = "Tools/Nianxie/Install WebGL Template To Assets";
    private const string MenuReinstall = "Tools/Nianxie/Reinstall WebGL Template To Assets (Force)";
    private const string MenuSelectTemplate = "Tools/Nianxie/Open WebGL Template Settings";
    private const string AutoInstallSessionKey = "Nianxie.AutoInstall.Completed";
    private const string WebGlTemplateName = "NianxieTemplate";

    static NianxieWebGLTemplateInstaller()
    {
        EditorApplication.delayCall += TryAutoInstallOnImport;
    }

    private static void TryAutoInstallOnImport()
    {
        // Run once per editor session to avoid repetitive copy prompts.
        if (SessionState.GetBool(AutoInstallSessionKey, false))
        {
            return;
        }
        SessionState.SetBool(AutoInstallSessionKey, true);
        InstallInternal(overwriteExisting: false, showDialogs: false);
        TrySetWebGlTemplate();
    }

    [MenuItem(MenuInstall)]
    public static void InstallToAssets()
    {
        InstallInternal(overwriteExisting: true, showDialogs: true);
        TrySetWebGlTemplate();
    }

    [MenuItem(MenuReinstall)]
    public static void ReinstallToAssets()
    {
        InstallInternal(overwriteExisting: true, showDialogs: true);
        TrySetWebGlTemplate();
    }

    [MenuItem(MenuSelectTemplate)]
    public static void OpenWebGLTemplateSettings()
    {
        SettingsService.OpenProjectSettings("Project/Player");
        EditorUtility.DisplayDialog(
            "Nianxie",
            "Open: Project Settings -> Player -> WebGL -> Resolution and Presentation -> WebGL Template\nThen choose 'NianxieTemplate'.",
            "OK");
    }

    private static void InstallInternal(bool overwriteExisting, bool showDialogs)
    {
        var packageRoot = GetPackageRoot();
        if (string.IsNullOrWhiteSpace(packageRoot))
        {
            if (showDialogs) EditorUtility.DisplayDialog("Nianxie", "Cannot resolve package root path.", "OK");
            return;
        }

        var targets = new[]
        {
            new CopyTarget("Assets/Scripts/NianxieBridge.cs", "Assets/Scripts/NianxieBridge.cs"),
            new CopyTarget("Assets/Plugins/WebGL/nianxie_bridge.jslib", "Assets/Plugins/WebGL/nianxie_bridge.jslib"),
            new CopyTarget("Assets/WebGLTemplates/NianxieTemplate", "Assets/WebGLTemplates/NianxieTemplate")
        };

        foreach (var target in targets)
        {
            var src = Path.Combine(packageRoot, target.FromRelative).Replace("\\", "/");
            var dst = target.ToRelative.Replace("\\", "/");

            if (!File.Exists(src) && !Directory.Exists(src))
            {
                Debug.LogWarning($"[NianxieInstaller] Missing source: {src}");
                continue;
            }

            EnsureParentDirectory(dst);

            if (File.Exists(dst) || Directory.Exists(dst))
            {
                if (!overwriteExisting) continue;
                FileUtil.DeleteFileOrDirectory(dst);
            }

            FileUtil.CopyFileOrDirectory(src, dst);
            Debug.Log($"[NianxieInstaller] Copied: {src} -> {dst}");
        }

        AssetDatabase.Refresh();
        if (showDialogs)
        {
            EditorUtility.DisplayDialog(
                "Nianxie",
                "Install finished.\n\nWebGL Template was set to 'NianxieTemplate' when possible.",
                "OK");
        }
    }

    private static string GetPackageRoot()
    {
        var package = PackageInfo.FindForAssembly(Assembly.GetExecutingAssembly());
        return package?.resolvedPath?.Replace("\\", "/");
    }

    private static void TrySetWebGlTemplate()
    {
        if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL)
        {
            // Template is still saved; Unity will apply once switching to WebGL.
        }

        try
        {
            // Unity 2021.3 API
            PlayerSettings.WebGL.template = WebGlTemplateName;
            Debug.Log($"[NianxieInstaller] WebGL template set to '{WebGlTemplateName}'.");
        }
        catch
        {
            Debug.LogWarning("[NianxieInstaller] Failed to set WebGL template automatically. Please set it manually in Player Settings.");
        }
    }

    private static void EnsureParentDirectory(string assetRelativePath)
    {
        var parent = Path.GetDirectoryName(assetRelativePath)?.Replace("\\", "/");
        if (string.IsNullOrWhiteSpace(parent)) return;
        if (Directory.Exists(parent)) return;
        Directory.CreateDirectory(parent);
    }

    private readonly struct CopyTarget
    {
        public CopyTarget(string fromRelative, string toRelative)
        {
            FromRelative = fromRelative;
            ToRelative = toRelative;
        }

        public string FromRelative { get; }
        public string ToRelative { get; }
    }
}
