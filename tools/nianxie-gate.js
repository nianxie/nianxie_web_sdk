#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

function runNodeScript(scriptName, passthroughArgs) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...passthroughArgs], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function printHelp() {
  process.stdout.write(`nianxie-gate commands:
  package
  verify-runtime
  preflight
  submit-prepare
  simulate-host

notes:
  - runtime bundle only needs nianxie-interaction-sdk.js
  - gate commands are local dev/CI tools
`);
}

const args = process.argv.slice(2);
const command = args[0];
const passthrough = args.slice(1);

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === 'package') runNodeScript('nx-package.js', passthrough);
else if (command === 'verify-runtime') runNodeScript('nx-verify-runtime.js', passthrough);
else if (command === 'preflight') runNodeScript('nx-preflight.js', passthrough);
else if (command === 'submit-prepare') runNodeScript('nx-submit-prepare.js', passthrough);
else if (command === 'simulate-host') runNodeScript('local-host-simulator.js', passthrough);
else {
  process.stderr.write(`Unknown command: ${command}\n`);
  process.exit(1);
}
