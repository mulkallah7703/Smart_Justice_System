/**
 * Cross-platform entry for `npm run ocr:langdata`.
 * Linux/macOS run the shell fetcher; Windows runs the PowerShell fetcher.
 * Both download ara + eng into backend/.ocr-data and never fetch at OCR time.
 */
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const scriptDir = __dirname;
const isWindows = process.platform === 'win32';

const result = isWindows
  ? spawnSync(
      'powershell',
      [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        join(scriptDir, 'fetch-ocr-lang-data.ps1'),
      ],
      { stdio: 'inherit' },
    )
  : spawnSync('bash', [join(scriptDir, 'fetch-ocr-lang-data.sh')], {
      stdio: 'inherit',
    });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
