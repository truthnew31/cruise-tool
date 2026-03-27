import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const port = process.env.PORT || '3001';

const child = spawn(
  process.execPath,
  [join(__dirname, 'node_modules/next/dist/bin/next'), 'dev', '--port', port],
  { stdio: 'inherit', cwd: __dirname }
);

child.on('exit', (code) => process.exit(code ?? 0));
