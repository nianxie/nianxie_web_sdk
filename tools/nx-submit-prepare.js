#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const { DIST_ZIP_PATH, REPORT_DIR, computeSha256, writeJson, readJsonSafe, collectOptionalJsonSources } = require('./nx-common');

function runPreflight() {
  const result = spawnSync('npm', ['run', 'nx:preflight'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

function main() {
  runPreflight();
  const sha256 = computeSha256(DIST_ZIP_PATH);
  const packageReportPath = path.join(REPORT_DIR, 'package-report.json');
  const packageReport = readJsonSafe(packageReportPath, {});
  const injectedFromPackageReport = Array.isArray(packageReport?.artifacts?.injectedJsonFiles)
    ? packageReport.artifacts.injectedJsonFiles
    : [];
  const optionalJsonSources = collectOptionalJsonSources();
  const reportPath = path.join(REPORT_DIR, 'submit-prepare.json');
  writeJson(reportPath, {
    ok: true,
    uploadArtifact: DIST_ZIP_PATH,
    sha256,
    optionalJsonFiles: {
      expectedFromSource: optionalJsonSources.filter((item) => item.shouldIncludeInZip).map((item) => ({
        name: item.name,
        source: item.sourcePath,
        targetInZip: item.targetInZip,
      })),
      injectedByPackage: injectedFromPackageReport,
    },
    generatedAt: new Date().toISOString(),
  });
  process.stdout.write(`[nx:submit:prepare] artifact => ${DIST_ZIP_PATH}\n`);
  process.stdout.write(`[nx:submit:prepare] sha256  => ${sha256}\n`);
  if (optionalJsonSources.some((item) => item.shouldIncludeInZip)) {
    process.stdout.write('[nx:submit:prepare] optional json metadata recorded\n');
  }
  process.stdout.write(`[nx:submit:prepare] report  => ${reportPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[nx:submit:prepare] failed: ${error.message}\n`);
  process.exit(1);
}
