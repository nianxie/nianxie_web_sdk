#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT_DIR,
  DIST_DIR,
  DIST_ZIP_PATH,
  REPORT_DIR,
  ensureDir,
  writeJson,
  getDistFiles,
  readDistFile,
  parseIndexRefs,
  normalizeRefPath,
  makeIssue,
  loadErrorDictionary,
  collectOptionalJsonSources,
} = require('./nx-common');

function runCommand(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT_DIR, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function packageWarnings() {
  const dict = loadErrorDictionary();
  const warnings = [];
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) return warnings;
  const indexText = readDistFile('index.html');
  const refs = parseIndexRefs(indexText);
  const REMOTE_ABSOLUTE_REGEX = /^[a-z][a-z0-9+\-.]*:\/\//i;
  let hasRemoteRef = false;
  for (const ref of refs) {
    const normalizedRef = String(ref).trim();
    if (!normalizedRef) continue;
    if (normalizedRef.startsWith('/')) {
      const meta = dict.NX_WARN_RELATIVE_PATH_RECOMMENDED || {};
      warnings.push(
        makeIssue(
          'NX_WARN_RELATIVE_PATH_RECOMMENDED',
          'package',
          'warning',
          'index.html 中存在绝对路径引用，宿主环境可能失效',
          meta.suggestion || '改为相对路径',
          normalizedRef
        )
      );
    }
    if (REMOTE_ABSOLUTE_REGEX.test(normalizedRef)) {
      hasRemoteRef = true;
    }
  }
  if (hasRemoteRef) {
    const meta = dict.NX_WARN_REMOTE_ASSET_NEEDS_FALLBACK || {};
    warnings.push(
      makeIssue(
        'NX_WARN_REMOTE_ASSET_NEEDS_FALLBACK',
        'package',
        'warning',
        '检测到线上静态资源引用，建议补充失败降级',
        meta.suggestion || '增加降级',
        'index.html'
      )
    );
  }
  return warnings;
}

function zipDist() {
  const optionalSources = collectOptionalJsonSources();
  const injectedFiles = [];
  const backups = [];

  const backupTag = `.nx-package-backup-${process.pid}-${Date.now()}`;

  for (const sourceInfo of optionalSources) {
    const sourcePath = sourceInfo.sourcePath;
    if (!sourcePath) continue;

    const targetPath = path.join(DIST_DIR, sourceInfo.name);
    if (path.resolve(sourcePath) === path.resolve(targetPath)) {
      injectedFiles.push({ name: sourceInfo.name, source: sourcePath, target: targetPath, copied: false });
      continue;
    }

    if (fs.existsSync(targetPath)) {
      const backupPath = `${targetPath}${backupTag}`;
      fs.renameSync(targetPath, backupPath);
      backups.push({ targetPath, backupPath });
    }

    fs.copyFileSync(sourcePath, targetPath);
    injectedFiles.push({ name: sourceInfo.name, source: sourcePath, target: targetPath, copied: true });
  }

  if (fs.existsSync(DIST_ZIP_PATH)) fs.rmSync(DIST_ZIP_PATH);
  try {
    const zipResult = spawnSync('zip', ['-rq', DIST_ZIP_PATH, 'dist'], { cwd: ROOT_DIR, stdio: 'pipe' });
    if (zipResult.status !== 0) {
      throw new Error('zip 命令执行失败，请确认系统已安装 zip');
    }
  } finally {
    for (const injected of injectedFiles) {
      if (!injected.copied) continue;
      if (fs.existsSync(injected.target)) {
        fs.rmSync(injected.target);
      }
    }
    for (const item of backups) {
      if (fs.existsSync(item.backupPath)) {
        fs.renameSync(item.backupPath, item.targetPath);
      }
    }
  }

  return injectedFiles.map((item) => ({
    name: item.name,
    source: item.source,
    targetInZip: `dist/${item.name}`,
  }));
}

function main() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const hasBuildScript = Boolean(packageJson?.scripts?.build);
  const buildCommand = process.env.NX_BUILD_COMMAND || 'npm';
  const buildArgsRaw = process.env.NX_BUILD_ARGS || 'run build';
  const buildArgs = buildArgsRaw.split(' ').filter(Boolean);

  runCommand('npm', ['install']);
  if (hasBuildScript || process.env.NX_BUILD_COMMAND) {
    runCommand(buildCommand, buildArgs);
  } else if (!fs.existsSync(DIST_DIR)) {
    throw new Error('未检测到 build 脚本，且不存在 dist/ 目录。请设置 NX_BUILD_COMMAND 或补充 build 脚本。');
  } else {
    process.stdout.write('[nx:package] build script missing, reuse existing dist/\n');
  }

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('构建完成后未发现 dist/ 目录');
  }
  const injectedJsonFiles = zipDist();

  ensureDir(REPORT_DIR);
  const warnings = packageWarnings();
  const distFiles = getDistFiles().map((item) => item.rel);
  const reportPath = path.join(REPORT_DIR, 'package-report.json');
  writeJson(reportPath, {
    phase: 'package',
    ok: true,
    warningCount: warnings.length,
    warnings,
    artifacts: {
      distPath: DIST_DIR,
      zipPath: DIST_ZIP_PATH,
      fileCount: distFiles.length,
      injectedJsonFiles,
    },
  });

  if (injectedJsonFiles.length > 0) {
    process.stdout.write(
      `[nx:package] injected optional json => ${injectedJsonFiles.map((item) => item.name).join(', ')}\n`
    );
  }
  process.stdout.write(`[nx:package] completed with ${warnings.length} warning(s)\n`);
  process.stdout.write(`[nx:package] report => ${reportPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[nx:package] failed: ${error.message}\n`);
  process.exit(1);
}
