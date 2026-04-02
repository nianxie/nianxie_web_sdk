#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { REPORT_DIR, DIST_DIR, makeIssue, writeJson, loadErrorDictionary } = require('./nx-common');

function runSimulator() {
  const dict = loadErrorDictionary();
  const issues = [];
  const phaseTimeline = [
    { phase: 'initSent', status: 'pending' },
    { phase: 'readyReceived', status: 'pending' },
    { phase: 'startSent', status: 'pending' },
    { phase: 'endReceived', status: 'pending' },
  ];

  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    issues.push(
      makeIssue(
        'NX_BLOCK_DIST_INDEX_MISSING',
        'runtime',
        'blocking',
        '模拟器未找到 dist/index.html',
        dict.NX_BLOCK_DIST_INDEX_MISSING?.suggestion || '请先构建 dist 产物',
        'dist/index.html'
      )
    );
  } else {
    phaseTimeline[0].status = 'ok';
    phaseTimeline[2].status = 'ok';
    const indexText = fs.readFileSync(indexPath, 'utf8');
    const hasReady = /sendReady\s*\(/.test(indexText) || /interaction_ready/.test(indexText);
    const hasEnd = /sendEnd\s*\(/.test(indexText) || /interaction_end/.test(indexText);
    phaseTimeline[1].status = hasReady ? 'ok' : 'failed';
    phaseTimeline[3].status = hasEnd ? 'ok' : 'failed';
    if (!hasReady || !hasEnd) {
      issues.push(
        makeIssue(
          'NX_BLOCK_PROTOCOL_HANDLER_MISSING',
          'runtime',
          'blocking',
          '本地宿主模拟器检测到时序闭环不完整',
          dict.NX_BLOCK_PROTOCOL_HANDLER_MISSING?.suggestion || '补齐 ready/end',
          'dist/index.html'
        )
      );
    }
  }

  return { issues, phaseTimeline };
}

function main() {
  const result = runSimulator();
  const reportPath = path.join(REPORT_DIR, 'local-host-simulator.json');
  writeJson(reportPath, {
    phase: 'runtime',
    ok: result.issues.length === 0,
    timeline: result.phaseTimeline,
    issues: result.issues,
  });
  process.stdout.write(`[nx:simulate:host] report => ${reportPath}\n`);
  if (result.issues.length > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[nx:simulate:host] failed: ${error.message}\n`);
  process.exit(1);
}
