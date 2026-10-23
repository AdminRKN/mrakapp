// shared helpers for the npm run dev / npm run tunnel launchers
import { spawn, spawnSync } from 'node:child_process';

/** run a command line with prefixed output; on Windows a shell spawns npm → node, so stop() kills the whole tree */
export function run(name, cmdline, color, opts = {}) {
  const p = spawn(cmdline, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], ...opts, env: { ...process.env, FORCE_COLOR: '1', ...opts.env } });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const out = (d) => {
    const text = d.toString();
    opts.onOutput?.(text);
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length && !opts.quiet) process.stdout.write(lines.map((l) => tag + l).join('\n') + '\n');
  };
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  p.stop = () => {
    if (p.exitCode !== null) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else p.kill('SIGTERM');
  };
  return p;
}

/** stop all children on Ctrl+C / terminal close / when one of them dies */
export function supervise(procs) {
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    procs.forEach((p) => p.stop());
    process.exit(code);
  };
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));
  process.on('SIGHUP', () => stop(0));
  procs.forEach((p) => p.on('exit', (code) => stop(code ?? 0)));
  return stop;
}
