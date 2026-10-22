const { spawnSync } = require('child_process');
const path = require('path');
const { getGoExecutable } = require('./go-resolver');

const go = getGoExecutable();
const apiDir = path.resolve(__dirname, '..', 'services', 'api');

console.log(`[Pulse Test] Running 'go test -v ./...' in ${apiDir}`);
const res = spawnSync(go, ['test', '-v', './...'], {
  cwd: apiDir,
  stdio: 'inherit',
});

process.exit(res.status || 0);
