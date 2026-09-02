import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('\x1b[36m%s\x1b[0m', '=======================================================');
console.log('\x1b[33m%s\x1b[0m', '  Gujarat Video Intelligence & Camera Management Portal');
console.log('\x1b[36m%s\x1b[0m', '=======================================================');
console.log('Starting Backend API on http://localhost:4000 ...');
console.log('Starting Frontend Web on http://localhost:5173 ...\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const apiProcess = spawn(npmCmd, ['run', 'dev', '--workspace=backend'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

const webProcess = spawn(npmCmd, ['run', 'dev', '--workspace=frontend'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  apiProcess.kill();
  webProcess.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
