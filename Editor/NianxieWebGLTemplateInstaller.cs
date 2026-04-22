using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

public static class NianxieWebGLTemplateInstaller
{
    private const string MenuInstallTemplate = "Tools/Nianxie/Install WebGL Template To Assets";
    private const string MenuInitBridgeInScene = "Tools/Nianxie/Init NianxieBridge In Current Scene";
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

    [MenuItem(MenuInitBridgeInScene)]
    public static void InitBridgeInCurrentScene()
    {
        try
        {
            var bridgeType = ResolveBridgeType();
            if (bridgeType == null)
            {
                Debug.LogError("失败: 未找到 NianxieBridge 脚本类型，请确认包已正确导入并编译完成。");
                return;
            }

            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid())
            {
                Debug.LogError("失败: 当前没有有效场景。");
                return;
            }

            var bridgeGo = GameObject.Find("NianxieBridge");
            if (bridgeGo == null)
            {
                bridgeGo = new GameObject("NianxieBridge");
                Undo.RegisterCreatedObjectUndo(bridgeGo, "Create NianxieBridge");
            }

            if (bridgeGo.GetComponent(bridgeType) == null)
            {
                Undo.AddComponent(bridgeGo, bridgeType);
            }

            Selection.activeGameObject = bridgeGo;
            EditorSceneManager.MarkSceneDirty(scene);
            Debug.Log($"成功: 已初始化 NianxieBridge 到场景 {scene.name}");
        }
        catch (Exception ex)
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

    private static Type ResolveBridgeType()
    {
        // Prefer direct lookup first.
        var direct = Type.GetType("NianxieBridge");
        if (direct != null && typeof(MonoBehaviour).IsAssignableFrom(direct))
        {
            return direct;
        }

        return AppDomain.CurrentDomain
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
            .FirstOrDefault(t => t != null
                                 && t.Name == "NianxieBridge"
                                 && typeof(MonoBehaviour).IsAssignableFrom(t));
    }
}
