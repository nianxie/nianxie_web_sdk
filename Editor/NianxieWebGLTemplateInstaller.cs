using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEngine;

public static class NianxieWebGLTemplateInstaller
{
    private const string MenuInstallTemplate = "Tools/Nianxie/Install WebGL Template To Assets";
    private const string MenuOpenTemplateSettings = "Tools/Nianxie/Open WebGL Template Settings";

    [MenuItem(MenuInstallTemplate)]
    public static void InstallTemplateToAssets()
    {
        var packageRoot = GetPackageRoot();
        if (string.IsNullOrWhiteSpace(packageRoot))
        {
            EditorUtility.DisplayDialog("Nianxie", "Cannot resolve package root path.", "OK");
            return;
        }

        var source = Path.Combine(packageRoot, "WebGLTemplates/NianxieTemplate").Replace("\\", "/");
        var target = "Assets/WebGLTemplates/NianxieTemplate";

        if (!Directory.Exists(source))
        {
            EditorUtility.DisplayDialog("Nianxie", $"Template source not found:\n{source}", "OK");
            return;
        }

        var parent = "Assets/WebGLTemplates";
        if (!Directory.Exists(parent))
        {
            Directory.CreateDirectory(parent);
        }

        if (Directory.Exists(target))
        {
            var overwrite = EditorUtility.DisplayDialog(
                "Nianxie",
                $"Target already exists:\n{target}\n\nOverwrite it?",
                "Overwrite",
                "Cancel");
            if (!overwrite) return;

            FileUtil.DeleteFileOrDirectory(target);
        }

        FileUtil.CopyFileOrDirectory(source, target);
        AssetDatabase.Refresh();

        EditorUtility.DisplayDialog(
            "Nianxie",
            "Template installed.\n\nNow select 'NianxieTemplate' in Player Settings -> WebGL Template.",
            "OK");
    }

    [MenuItem(MenuOpenTemplateSettings)]
    public static void OpenTemplateSettings()
    {
        SettingsService.OpenProjectSettings("Project/Player");
        EditorUtility.DisplayDialog(
            "Nianxie",
            "Open: Project Settings -> Player -> WebGL -> Resolution and Presentation -> WebGL Template\nThen choose 'NianxieTemplate'.",
            "OK");
    }

    private static string GetPackageRoot()
    {
        var package = UnityEditor.PackageManager.PackageInfo.FindForAssembly(Assembly.GetExecutingAssembly());
        return package?.resolvedPath?.Replace("\\", "/");
    }
}
