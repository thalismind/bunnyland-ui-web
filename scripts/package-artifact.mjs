import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'artifacts');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npm, ['pack', '--pack-destination', outDir], {
  cwd: root,
  env: {
    ...process.env,
    npm_config_cache: join(root, '.npm-cache'),
    npm_config_update_notifier: 'false',
  },
  stdio: 'inherit',
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('close', code => resolve(code ?? 1));
});
if (exitCode !== 0) process.exitCode = Number(exitCode) || 1;
