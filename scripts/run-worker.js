const { spawn } = require('child_process');
const path = require('path');
const { getGoExecutable } = require('./go-resolver');
const fs = require('fs');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn(`[Pulse Worker] Note: .env loading skipped: ${err.message}`);
  }
}

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
