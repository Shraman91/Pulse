const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGoExecutable() {
  // 1. Try command in PATH
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'where go' : 'which go';
    const result = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n')[0].trim();
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch (e) {
    // ignore
  }

  // 2. Check well-known Windows locations
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Go\\bin\\go.exe',
      'C:\\Go\\bin\\go.exe',
      path.join(process.env.USERPROFILE || '', 'go', 'bin', 'go.exe'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  }

  // 3. Fallback to 'go'
  return 'go';
}

module.exports = { getGoExecutable };
