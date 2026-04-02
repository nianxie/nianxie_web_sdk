#!/usr/bin/env node
const { spawnSync } = require('child_process');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('npm', ['run', 'nx:package']);
run('npm', ['run', 'nx:verify:runtime']);
process.stdout.write('[nx:preflight] passed\n');
