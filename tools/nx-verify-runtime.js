#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
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
} = require('./nx-common');

const DEV_RUNTIME_REGEX = /@vite\/client|import\.meta\.hot|localhost|127\.0\.0\.1|0\.0\.0\.0/i;
const SDK_SIGNAL_REGEX = /nianxie-interaction-sdk\.js|NianxieInteractionSDK|createNianxieInteractionSDK/;
const MEDIA_REF_REGEX = /["'`]([^"'`]+\.(?:png|jpg|jpeg|gif|webp|svg|mp3|wav|ogg|m4a|aac|flac|mp4|webm))(?:\?[^"'`]*)?["'`]/gi;
const REMOTE_ABSOLUTE_REGEX = /^[a-z][a-z0-9+\-.]*:\/\//i;

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

  const jsFiles = getDistFiles().filter((item) => item.rel.endsWith('.js'));
  const runtimeScriptSources = [
    ...jsFiles.map((item) => ({ source: fs.readFileSync(item.abs, 'utf8'), path: item.rel })),
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
        '先执行打包生成 dist.zip',
        DIST_ZIP_PATH
      )
    );
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
