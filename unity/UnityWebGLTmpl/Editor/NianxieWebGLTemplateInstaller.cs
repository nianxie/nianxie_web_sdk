using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEngine;

public static class NianxieWebGLTemplateInstaller
{
    private const string MenuInstall = "Tools/Nianxie/Install WebGL Template To Assets";
    private const string MenuSelectTemplate = "Tools/Nianxie/Open WebGL Template Settings";

    [MenuItem(MenuInstall)]
    public static void InstallToAssets()
    {
        var packageRoot = GetPackageRoot();
        if (string.IsNullOrWhiteSpace(packageRoot))
        {
            EditorUtility.DisplayDialog("Nianxie", "Cannot resolve package root path.", "OK");
            return;
        }

        var targets = new[]
        {
            new CopyTarget("Assets/Scripts/NianxieBridge.cs", "Assets/Scripts/NianxieBridge.cs"),
            new CopyTarget("Assets/Plugins/WebGL/nianxie_bridge.jslib", "Assets/Plugins/WebGL/nianxie_bridge.jslib"),
            new CopyTarget(
                "Assets/WebGLTemplates/NianxieTemplate",
                "Assets/WebGLTemplates/NianxieTemplate")
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
                var overwrite = EditorUtility.DisplayDialog(
                    "Nianxie",
                    $"Target already exists:\n{dst}\n\nOverwrite it?",
                    "Overwrite",
                    "Skip");
                if (!overwrite) continue;

                FileUtil.DeleteFileOrDirectory(dst);
            }

            FileUtil.CopyFileOrDirectory(src, dst);
            Debug.Log($"[NianxieInstaller] Copied: {src} -> {dst}");
        }

        AssetDatabase.Refresh();
        EditorUtility.DisplayDialog(
            "Nianxie",
            "Install finished.\n\nNow set WebGL Template to 'NianxieTemplate' in Player Settings.",
            "OK");
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

    private static string GetPackageRoot()
    {
        var package = PackageInfo.FindForAssembly(Assembly.GetExecutingAssembly());
        return package?.resolvedPath?.Replace("\\", "/");
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
