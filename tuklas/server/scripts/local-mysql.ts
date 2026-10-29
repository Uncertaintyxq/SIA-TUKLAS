  // Runs Tuklas's MySQL from a local MySQL 8+ install, for computers without Docker. It is set up
// like docker-compose.yml (database tuklas, user tuklas/tuklas, then database/docker-init/) and
// listens on DATABASE_URL's port. Data lives in database/.local-mysql/ (gitignored).
//   npm run db:local         start it (creates it on first run)
//   npm run db:local:stop    stop it
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { connect } from 'node:net';
import { delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/env.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = `${root}database/.local-mysql/`;
const dataDir = `${dir}data`;
const log = `${dir}mysqld.err`;
const port = Number(new URL(env.DATABASE_URL).port || 3306);
// Short and outside the project: macOS limits socket paths to 103 characters.
const socket = '/tmp/tuklas-mysql.sock';
const asRoot = ['-uroot', `--socket=${socket}`];

// The installer from dev.mysql.com puts MySQL in /usr/local/mysql without adding it to PATH.
const bin = ['/usr/local/mysql/bin', ...(process.env.PATH ?? '').split(delimiter)].find((d) => d && existsSync(`${d}/mysqld`));
if (!bin) {
  console.error('Couldn’t find MySQL. Install MySQL 8+ from https://dev.mysql.com/downloads/mysql/ (or Docker Desktop, then use npm run db:up).');
  process.exit(1);
}

/** Runs a MySQL program and returns whether it succeeded. Its errors show in the terminal unless `quiet`. */
function run(program: string, args: string[], { input, quiet = false }: { input?: string; quiet?: boolean } = {}) {
  const { status } = spawnSync(`${bin}/${program}`, ['--no-defaults', ...args], {
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'ignore', quiet ? 'ignore' : 'inherit'],
  });
  return status === 0;
}

const isRunning = () => run('mysqladmin', [...asRoot, 'ping'], { quiet: true });

// Whether another program already accepts connections on the port. Checked up front because MySQL
// won't refuse to start: on macOS it can bind 127.0.0.1 on a port another program holds on all
// addresses (like a MySQL on *:3306), and would then take that program's local connections.
const portTaken = () =>
  new Promise<boolean>((resolve) => {
    const probe = connect({ host: 'localhost', port }, () => {
      probe.destroy();
      resolve(true);
    });
    probe.on('error', () => resolve(false));
  });

/** Prints the errors MySQL logged after byte `logStart` of its log, then exits. */
function fail(logStart: number): never {
  const errors = existsSync(log)
    ? readFileSync(log).subarray(logStart).toString().split('\n').filter((line) => line.includes('[ERROR]'))
    : [];
  console.error(`MySQL didn’t start. Errors from ${log}:\n${errors.join('\n')}`);
  process.exit(1);
}

async function start() {
  if (isRunning()) {
    console.log('Tuklas’s MySQL is already running.');
    return;
  }
  if (await portTaken()) {
    console.error(`Something else is using port ${port}. Set a free port in DATABASE_URL in server/.env (e.g. 3307), then run this again.`);
    process.exit(1);
  }
  // Leftovers from a MySQL that didn't shut down cleanly.
  rmSync(socket, { force: true });
  rmSync(`${socket}.lock`, { force: true });
  mkdirSync(dir, { recursive: true });
  const logStart = existsSync(log) ? statSync(log).size : 0;
  const fresh = !existsSync(dataDir);
  // root gets no password; the server below only accepts connections from this computer.
  if (fresh && !run('mysqld', ['--initialize-insecure', `--datadir=${dataDir}`, `--log-error=${log}`])) {
    rmSync(dataDir, { recursive: true, force: true });
    fail(logStart);
  }
  const started = run('mysqld', [
    '--daemonize', // returns once the server accepts connections
    `--datadir=${dataDir}`,
    `--log-error=${log}`,
    `--port=${port}`,
    '--bind-address=127.0.0.1,::1',
    `--socket=${socket}`,
    '--mysqlx=OFF', // its port, 33060, would clash with any other MySQL on this computer
  ]);
  if (!started) fail(logStart);

  // What the mysql Docker image does for docker-compose.yml, then database/docker-init/. Safe to repeat.
  const initDir = `${root}database/docker-init/`;
  const setup = [
    'CREATE DATABASE IF NOT EXISTS tuklas;',
    "CREATE USER IF NOT EXISTS 'tuklas'@'%' IDENTIFIED BY 'tuklas';",
    "GRANT ALL PRIVILEGES ON tuklas.* TO 'tuklas'@'%';",
    ...readdirSync(initDir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(initDir + f, 'utf8')),
  ];
  if (!run('mysql', asRoot, { input: setup.join('\n') })) process.exit(1);

  console.log(`MySQL is running on localhost:${port}. Stop it with npm run db:local:stop.`);
  if (fresh) console.log('It’s a new, empty database: run npm run db:reset to create the tables and demo data.');
}

function stop() {
  if (!isRunning()) {
    console.log('Tuklas’s MySQL isn’t running.');
    return;
  }
  if (!run('mysqladmin', [...asRoot, 'shutdown'])) process.exit(1);
  console.log('Stopped Tuklas’s MySQL.');
}

if (process.argv[2] === 'stop') stop();
else await start();
