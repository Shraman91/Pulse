const { spawn } = require('child_process');
const path = require('path');
const { getGoExecutable } = require('./go-resolver');

const go = getGoExecutable();
const apiDir = path.resolve(__dirname, '..', 'services', 'api');

console.log(`[Pulse API] Running from ${apiDir} with Go: ${go}`);
const child = spawn(go, ['run', './cmd/api'], {
  cwd: apiDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: process.env.PORT || '8080',
    PULSE_ENV: process.env.PULSE_ENV || 'development',
  },
});

child.on('close', (code) => {
  process.exit(code || 0);
});
