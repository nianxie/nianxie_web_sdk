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

            CopyDirectoryWithoutMeta(source, target);
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
                LogBridgeResolutionDiagnostics();
                Debug.LogError("失败: 未找到 NianxieBridge 脚本类型。通常是编译未通过（而非路径问题），请先修复 Console 中的 C# 编译错误后重试。");
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
        var package = UnityEditor.PackageManager.PackageInfo.FindForAssembly(System.Reflection.Assembly.GetExecutingAssembly());
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

        var viaAssemblies = AppDomain.CurrentDomain
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

        if (viaAssemblies != null) return viaAssemblies;

        // Last fallback: resolve through MonoScript assets (works better in some package compile edge-cases).
        var guids = AssetDatabase.FindAssets("NianxieBridge t:MonoScript");
        foreach (var guid in guids)
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            if (string.IsNullOrWhiteSpace(path)) continue;
            var monoScript = AssetDatabase.LoadAssetAtPath<MonoScript>(path);
            if (monoScript == null) continue;
            var klass = monoScript.GetClass();
            if (klass != null && typeof(MonoBehaviour).IsAssignableFrom(klass) && klass.Name == "NianxieBridge")
            {
                return klass;
            }
        }

        return null;
    }

    private static void LogBridgeResolutionDiagnostics()
    {
        var guids = AssetDatabase.FindAssets("NianxieBridge t:MonoScript");
        if (guids == null || guids.Length == 0)
        {
            Debug.LogWarning("诊断: 未找到任何名为 NianxieBridge 的 MonoScript 资源。请确认 package 版本与分支。");
        }
        else
        {
            foreach (var guid in guids)
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var monoScript = AssetDatabase.LoadAssetAtPath<MonoScript>(path);
                var klass = monoScript?.GetClass();
                Debug.LogWarning($"诊断: script={path}, class={(klass == null ? "NULL(编译失败或未加载)" : klass.FullName)}");
            }
        }

        Debug.LogWarning("诊断: 请查看 Unity Console 中是否存在 C# 编译错误；若有，先修复后再执行 Init NianxieBridge。");
    }

    private static void CopyDirectoryWithoutMeta(string sourceDir, string targetDir)
    {
        if (!Directory.Exists(sourceDir))
        {
            throw new DirectoryNotFoundException($"source not found: {sourceDir}");
        }

        if (!Directory.Exists(targetDir))
        {
            Directory.CreateDirectory(targetDir);
        }

        foreach (var directory in Directory.GetDirectories(sourceDir))
        {
            var folderName = Path.GetFileName(directory);
            if (string.IsNullOrEmpty(folderName)) continue;
            var childTarget = Path.Combine(targetDir, folderName);
            CopyDirectoryWithoutMeta(directory, childTarget);
        }

        foreach (var file in Directory.GetFiles(sourceDir))
        {
            if (file.EndsWith(".meta", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var fileName = Path.GetFileName(file);
            if (string.IsNullOrEmpty(fileName)) continue;
            var targetFile = Path.Combine(targetDir, fileName);
            File.Copy(file, targetFile, true);
        }
    }
}
