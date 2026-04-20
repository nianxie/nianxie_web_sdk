#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT_DIR,
  DIST_DIR,
  DIST_ZIP_PATH,
  REPORT_DIR,
  writeJson,
  getDistFiles,
  readDistFile,
  parseIndexRefs,
  extractInlineScriptContents,
  normalizeRefPath,
  makeIssue,
  loadErrorDictionary,
  collectOptionalJsonSources,
} = require('./nx-common');

const DEV_RUNTIME_REGEX = /@vite\/client|import\.meta\.hot|localhost|127\.0\.0\.1|0\.0\.0\.0/i;
const SDK_SIGNAL_REGEX = /nianxie-interaction-sdk\.js|NianxieInteractionSDK|createNianxieInteractionSDK/;
const MEDIA_REF_REGEX = /["'`]([^"'`]+\.(?:png|jpg|jpeg|gif|webp|svg|mp3|wav|ogg|m4a|aac|flac|mp4|webm))(?:\?[^"'`]*)?["'`]/gi;
const REMOTE_ABSOLUTE_REGEX = /^[a-z][a-z0-9+\-.]*:\/\//i;
const INDEX_SCRIPT_REGEX = /<script[^>]+src=['"]([^'"]+)['"][^>]*>/gi;
const CSS_URL_REGEX = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

function resolveResourceRef(rawRef, baseDir = '') {
  const trimmed = String(rawRef || '').trim();
  if (!trimmed) return { resolved: null, isAbsolute: false, skip: true };
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) {
    return { resolved: null, isAbsolute: false, skip: true };
  }
  if (REMOTE_ABSOLUTE_REGEX.test(trimmed)) return { resolved: null, isAbsolute: false, skip: true };
  if (trimmed.startsWith('/')) return { resolved: null, isAbsolute: true, skip: false };
  const noHash = trimmed.split('#', 1)[0] || '';
  const noQuery = noHash.split('?', 1)[0] || '';
  const normalized = path.posix.normalize(path.posix.join(baseDir, noQuery)).replace(/^\.?\//, '');
  return { resolved: normalized || null, isAbsolute: false, skip: false };
}

function resolveSuggestion(dict, code, fallback) {
  const meta = dict[code] || {};
  return meta.suggestion || fallback;
}

function listZipEntries() {
  if (!fs.existsSync(DIST_ZIP_PATH)) return [];
  let result = spawnSync('unzip', ['-Z1', DIST_ZIP_PATH], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    result = spawnSync('zipinfo', ['-1', DIST_ZIP_PATH], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  }
  if (result.status !== 0) {
    throw new Error(`无法读取 dist.zip 内容：${result.stderr || result.stdout || 'unknown error'}`);
  }
  return String(result.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function checkRuntime() {
  const dict = loadErrorDictionary();
  const issues = [];
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    issues.push(
      makeIssue(
        'NX_BLOCK_DIST_INDEX_MISSING',
        'runtime',
        'blocking',
        '缺少 dist/index.html',
        resolveSuggestion(dict, 'NX_BLOCK_DIST_INDEX_MISSING', '请补齐入口文件'),
        'dist/index.html'
      )
    );
    return issues;
  }

  const distFileSet = new Set(getDistFiles().map((item) => item.rel));
  const indexText = readDistFile('index.html');
  const inlineScripts = extractInlineScriptContents(indexText);

  const refs = parseIndexRefs(indexText);
  for (const ref of refs) {
    const trimmed = String(ref).trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('/')) {
      issues.push(
        makeIssue(
          'NX_BLOCK_ABSOLUTE_PATH_IN_INDEX',
          'runtime',
          'blocking',
          'index.html 使用绝对路径依赖',
          resolveSuggestion(dict, 'NX_BLOCK_ABSOLUTE_PATH_IN_INDEX', '改为相对路径'),
          trimmed
        )
      );
      continue;
    }
    const normalized = normalizeRefPath(trimmed);
    if (normalized && !distFileSet.has(normalized)) {
      issues.push(
        makeIssue(
          'NX_BLOCK_ENTRY_ASSET_MISSING',
          'runtime',
          'blocking',
          'index.html 入口资源在 dist 中不存在',
          resolveSuggestion(dict, 'NX_BLOCK_ENTRY_ASSET_MISSING', '修正入口资源路径'),
          normalized
        )
      );
    }
  }

  const referencedScriptPaths = new Set();
  for (const match of indexText.matchAll(INDEX_SCRIPT_REGEX)) {
    const rawRef = match[1] || '';
    const parsed = resolveResourceRef(rawRef, '');
    if (parsed.skip || parsed.isAbsolute || !parsed.resolved) continue;
    if (!distFileSet.has(parsed.resolved)) continue;
    if (!/\.m?js$/i.test(parsed.resolved)) continue;
    referencedScriptPaths.add(parsed.resolved);
  }

  const runtimeScriptSources = [
    ...Array.from(referencedScriptPaths).map((relPath) => ({
      source: fs.readFileSync(path.join(DIST_DIR, relPath), 'utf8'),
      path: relPath,
    })),
    ...inlineScripts.map((source, index) => ({ source, path: `index.html:inline-script#${index + 1}` })),
  ];

  const hasSdkSignal = SDK_SIGNAL_REGEX.test(indexText) || runtimeScriptSources.some((item) => SDK_SIGNAL_REGEX.test(item.source));
  if (!hasSdkSignal) {
    issues.push(
      makeIssue(
        'NX_BLOCK_SDK_REFERENCE_MISSING',
        'runtime',
        'blocking',
        '未检测到 SDK 接入信号（脚本引用或 SDK 调用）',
        resolveSuggestion(dict, 'NX_BLOCK_SDK_REFERENCE_MISSING', '引入 SDK'),
        'index.html'
      )
    );
  }

  const protocolFingerprint = { onInit: false, onStart: false, sendReady: false, sendEnd: false };
  const missingAssetRefSet = new Set();
  const absoluteAssetRefSet = new Set();
  for (const runtimeScript of runtimeScriptSources) {
    const source = runtimeScript.source;
    const baseDir = runtimeScript.path.startsWith('index.html:inline-script')
      ? ''
      : path.posix.dirname(runtimeScript.path);
    if (DEV_RUNTIME_REGEX.test(source)) {
      issues.push(
        makeIssue(
          'NX_BLOCK_DEV_RUNTIME_MARKER',
          'runtime',
          'blocking',
          '检测到 dev runtime 标记',
          resolveSuggestion(dict, 'NX_BLOCK_DEV_RUNTIME_MARKER', '请上传生产构建产物'),
          runtimeScript.path
        )
      );
    }
    if (/\.onInit\s*\(/.test(source)) protocolFingerprint.onInit = true;
    if (/\.onStart\s*\(/.test(source)) protocolFingerprint.onStart = true;
    if (/\.sendReady\s*\(/.test(source)) protocolFingerprint.sendReady = true;
    if (/\.sendEnd\s*\(/.test(source)) protocolFingerprint.sendEnd = true;

    for (const match of source.matchAll(MEDIA_REF_REGEX)) {
      const rawRef = match[1] || '';
      const parsed = resolveResourceRef(rawRef, baseDir);
      if (parsed.skip) continue;
      if (parsed.isAbsolute) {
        absoluteAssetRefSet.add(rawRef);
        continue;
      }
      if (parsed.resolved && !distFileSet.has(parsed.resolved)) {
        missingAssetRefSet.add(`${rawRef} -> ${parsed.resolved}`);
      }
    }
  }

  for (const absoluteRef of absoluteAssetRefSet) {
    issues.push(
      makeIssue(
        'NX_BLOCK_ABSOLUTE_PATH_IN_INDEX',
        'runtime',
        'blocking',
        '检测到脚本中的绝对路径资源引用，宿主环境可能无法命中',
        resolveSuggestion(dict, 'NX_BLOCK_ABSOLUTE_PATH_IN_INDEX', '改为相对路径引用'),
        absoluteRef
      )
    );
  }

  for (const missingRef of missingAssetRefSet) {
    issues.push(
      makeIssue(
        'NX_BLOCK_ENTRY_ASSET_MISSING',
        'runtime',
        'blocking',
        '检测到脚本资源引用未命中 dist 文件',
        resolveSuggestion(dict, 'NX_BLOCK_ENTRY_ASSET_MISSING', '补齐资源或修正引用路径'),
        missingRef
      )
    );
  }

  // CSS absolute-path guard for OSS/static hosting compatibility.
  const cssFiles = getDistFiles().filter((item) => item.rel.endsWith('.css'));
  for (const cssFile of cssFiles) {
    const cssText = fs.readFileSync(cssFile.abs, 'utf8');
    for (const match of cssText.matchAll(CSS_URL_REGEX)) {
      const rawRef = String(match[2] || '').trim();
      if (!rawRef || REMOTE_ABSOLUTE_REGEX.test(rawRef) || rawRef.startsWith('data:') || rawRef.startsWith('blob:')) continue;
      if (rawRef.startsWith('/')) {
        issues.push(
          makeIssue(
            'NX_BLOCK_ABSOLUTE_PATH_IN_INDEX',
            'runtime',
            'blocking',
            '检测到 CSS 绝对路径资源引用，上传 OSS 后可能无法命中',
            resolveSuggestion(dict, 'NX_BLOCK_ABSOLUTE_PATH_IN_INDEX', '改为相对路径引用'),
            `${cssFile.rel}: ${rawRef}`
          )
        );
      }
    }
  }

  const missingHandlers = Object.entries(protocolFingerprint)
    .filter((entry) => !entry[1])
    .map((entry) => entry[0]);
  if (missingHandlers.length > 0) {
    issues.push(
      makeIssue(
        'NX_BLOCK_PROTOCOL_HANDLER_MISSING',
        'runtime',
        'blocking',
        `未检测到完整协议闭环: ${missingHandlers.join(', ')}`,
        resolveSuggestion(dict, 'NX_BLOCK_PROTOCOL_HANDLER_MISSING', '补齐 onInit/onStart/sendReady/sendEnd'),
        'dist/*.js or index.html inline scripts'
      )
    );
  }

  if (!fs.existsSync(DIST_ZIP_PATH)) {
    issues.push(
      makeIssue(
        'NX_BLOCK_ENTRY_ASSET_MISSING',
        'runtime',
        'blocking',
        '缺少 dist.zip，无法进入提交流程',
        '先执行 npm run nx:package 生成 dist.zip',
        DIST_ZIP_PATH
      )
    );
  } else {
    const zipEntries = new Set(listZipEntries());
    const optionalJsonSources = collectOptionalJsonSources();
    for (const item of optionalJsonSources) {
      if (!item.shouldIncludeInZip) continue;
      if (!zipEntries.has(item.targetInZip)) {
        issues.push(
          makeIssue(
            'NX_BLOCK_ENTRY_ASSET_MISSING',
            'runtime',
            'blocking',
            `检测到 ${item.name} 源文件存在，但 dist.zip 缺少同级注入文件`,
            `请确保执行 nx:package 时将 ${item.name} 注入到 dist/ 根目录`,
            item.targetInZip
          )
        );
      }
    }
  }

  return issues;
}

function main() {
  const issues = checkRuntime();
  const reportPath = path.join(REPORT_DIR, 'runtime-verify.json');
  writeJson(reportPath, {
    phase: 'runtime',
    ok: issues.length === 0,
    blockingCount: issues.length,
    issues,
  });
  process.stdout.write(`[nx:verify:runtime] report => ${reportPath}\n`);
  if (issues.length > 0) {
    process.stderr.write(`[nx:verify:runtime] blocking issues: ${issues.length}\n`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`[nx:verify:runtime] failed: ${error.message}\n`);
  process.exit(1);
}
