const { spawnSync } = require('child_process');
const path = require('path');
const { getGoExecutable } = require('./go-resolver');

const go = getGoExecutable();
const apiDir = path.resolve(__dirname, '..', 'services', 'api');

console.log(`[Pulse Lint] Running 'go vet ./...' in ${apiDir}`);
const res = spawnSync(go, ['vet', './...'], {
  cwd: apiDir,
  stdio: 'inherit',
});

process.exit(res.status || 0);
