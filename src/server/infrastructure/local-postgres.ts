import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const execute = promisify(execFile);
async function nativePath(input: string): Promise<string> {
  if (process.platform !== 'win32') return input;
  const result = await execute('cmd.exe', [
    '/d', '/v:off', '/c', 'for %I in ("%BEATSTORE_NATIVE_PATH%") do @echo %~sI',
  ], { windowsHide: true, windowsVerbatimArguments: true, encoding: 'utf8', env: { ...process.env, BEATSTORE_NATIVE_PATH: input } });
  const value = result.stdout.trim();
  if (/[^\x00-\x7F]/.test(value)) {
    throw new Error('Local PostgreSQL needs an ASCII Windows path or DATABASE_URL');
  }
  return value;
}

export async function startLocalPostgres(options: {
  dataDir: string; user: string; password: string; port: number;
}): Promise<{ stop(): Promise<void> }> {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const moduleName = `@embedded-postgres/${platform}-${process.arch}`;
  const binaries = await import(moduleName) as { initdb: string; pg_ctl: string };
  const dataDir = path.join(options.dataDir, 'postgres');
  await mkdir(dataDir, { recursive: true });
  const [databasePath, initdb, pgCtl] = await Promise.all([
    nativePath(dataDir), nativePath(binaries.initdb), nativePath(binaries.pg_ctl),
  ]);
  const nativeRoot = path.dirname(databasePath);
  const run = (binary: string, args: string[]) => new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true, cwd: nativeRoot, env: { ...process.env, LC_MESSAGES: 'C' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errors = '';
    child.stderr.on('data', (chunk: Buffer) => { errors = (errors + chunk.toString()).slice(-8000); });
    child.once('error', reject);
    child.once('exit', (code) => {
      child.stderr.destroy();
      if (code === 0) resolve();
      else reject(new Error(`PostgreSQL command exited with ${code}: ${errors}`));
    });
  });
  let initialized = true;
  try { await access(path.join(dataDir, 'PG_VERSION')); } catch { initialized = false; }
  if (!initialized) {
    const passwordFile = path.join(options.dataDir, `init-password-${randomUUID()}`);
    await writeFile(passwordFile, options.password + '\n', { mode: 0o600, flag: 'wx' });
    try {
      await run(initdb, [
        `--pgdata=${databasePath}`, `--username=${options.user}`, '--auth=scram-sha-256',
        `--pwfile=${await nativePath(passwordFile)}`, '--encoding=UTF8', '--no-locale', '--lc-messages=C',
      ]);
    } finally { await unlink(passwordFile); }
  }
  await run(pgCtl, [
    '-D', databasePath, '-l', path.join(nativeRoot, 'postgres.log'), '-w', '-t', '30',
    '-o', `-p ${options.port} -h 127.0.0.1`, 'start',
  ]);
  return { async stop() { await run(pgCtl, ['-D', databasePath, '-m', 'fast', '-w', '-t', '30', 'stop']); } };
}
