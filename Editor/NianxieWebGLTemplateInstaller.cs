using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEngine;

public static class NianxieWebGLTemplateInstaller
{
    private const string MenuInstallTemplate = "Tools/Nianxie/Install WebGL Template To Assets";
    private const string PackageName = "com.nianxie.webgl-template";

    [MenuItem(MenuInstallTemplate)]
    public static void InstallTemplateToAssets()
    {
        try
        {
            var packageRoot = GetPackageRoot();
            if (string.IsNullOrWhiteSpace(packageRoot))
            {
                Debug.LogError("失败: 无法解析 package 根目录");
                return;
            }

            var source = Path.Combine(packageRoot, "WebGLTemplates/NianxieTemplate").Replace("\\", "/");
            var target = "Assets/WebGLTemplates/NianxieTemplate";

            if (!Directory.Exists(source))
            {
                Debug.LogError($"失败: 模板目录不存在 -> {source}");
                return;
            }

            var parent = "Assets/WebGLTemplates";
            if (!Directory.Exists(parent))
            {
                Directory.CreateDirectory(parent);
            }

            if (Directory.Exists(target))
            {
                FileUtil.DeleteFileOrDirectory(target);
            }

            FileUtil.CopyFileOrDirectory(source, target);
            AssetDatabase.Refresh();
            Debug.Log("成功");
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"失败: {ex.Message}");
        }
    }

    private static string GetPackageRoot()
    {
        // Preferred: resolve by package name. Works even when this menu script is copied into Assets/.
        var rootByName = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Packages", PackageName))
            .Replace("\\", "/");
        if (Directory.Exists(rootByName))
        {
            return rootByName;
        }

        // Fallback: resolve by the assembly this script belongs to.
        var package = UnityEditor.PackageManager.PackageInfo.FindForAssembly(Assembly.GetExecutingAssembly());
        return package?.resolvedPath?.Replace("\\", "/");
    }
}
