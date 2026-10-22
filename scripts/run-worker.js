const { spawn } = require('child_process');
const path = require('path');
const { getGoExecutable } = require('./go-resolver');

const go = getGoExecutable();
const apiDir = path.resolve(__dirname, '..', 'services', 'api');

console.log(`[Pulse Worker] Running from ${apiDir} with Go: ${go}`);
const child = spawn(go, ['run', './cmd/worker'], {
  cwd: apiDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PULSE_ENV: process.env.PULSE_ENV || 'development',
  },
});

child.on('close', (code) => {
  process.exit(code || 0);
});
