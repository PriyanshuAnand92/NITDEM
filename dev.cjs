const { spawn } = require('child_process');

const children = [];

function spawnProcess(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Process ${cmd} exited with code ${code}`);
      cleanupAndExit(code);
    }
  });
}

function cleanupAndExit(code = 0) {
  console.log('\n[NITDEM] Shutting down dev server and GCS sync daemon...');
  children.forEach(child => {
    try {
      child.kill('SIGTERM');
    } catch (e) {}
  });
  process.exit(code);
}

// Handle termination signals
process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));
process.on('exit', () => cleanupAndExit(0));

console.log('[NITDEM] Starting background GCS Sync Daemon...');
// Start sync daemon
spawnProcess('node', ['sync_datasets.cjs']);

console.log('[NITDEM] Starting Vite Development Server...');
// Start Vite dev server
spawnProcess('npx', ['vite'], { shell: true });
