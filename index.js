#!/usr/bin/env node

const CLI = require('class-cli');
const OS = require('os');
const Path = require('path');
const fs = require('fs-extra');
const CP = require('child_process');
const readUntilDeleted = require('read-until-deleted');

class WinSudo extends CLI {
  homeDir = OS.homedir();
  command = CLI.option({ type: 'array' });
  lockfile = CLI.option({ type: 'string', default: Path.join(this.homeDir, '.win-sudo-lockfile') });

  $register = CLI.command({
    command: '$register',
    handler: function register() {
      return this.spawn(`SCHTASKS /Create /TN "win-sudo" /SC ONCE /ST 00:00 /RL HIGHEST /TR "CMD.EXE /C START /MIN 'win-sudo' '${process.execPath}' '${__filename}' $run"`);
    }
  });

  run = CLI.command({
    command: '$0 <command..>',
    handler: async function run() {
      if (fs.existsSync(this.lockfile)) throw `Lockfile '${this.lockfile}' already exists. Either last task is still running or didn't exit cleanly. Please delete the file manually and retry`;
      const context = {};
      context.command = this.command;
      context.id = +new Date;
      // context.id = '111';
      for (const id of ['stdout', 'stderr', 'stdin', 'exit']) {
        context[id] = Path.join(OS.tmpdir(), `win-sudo_${context.id}_${id}.txt`);
        await fs.ensureFile(context[id]);
      }
      await this.write(context);
      const stream = {};
      for (const stdio of ['stdout', 'stderr']) {
        // read[stdio] = FS.createReadStream(context.stdout, { tail: true });
        stream[stdio] = await readUntilDeleted(context[stdio]);
        stream[stdio].pipe(process[stdio]);
      }
      stream.stdin = fs.createWriteStream(context.stdin);
      process.stdin.pipe(stream.stdin);
      await this.spawn(`SCHTASKS /Run /TN "win-sudo"`, { stdio: 'pipe' });
      const exitCode = await new Promise(resolve => {
        const watcher = fs.watch(context.exit, () => {
          // console.log('exited');
          watcher.close();
          const exitCode = fs.readFileSync(context.exit, 'utf8');
          resolve(exitCode);
        });
      });
      await this.delay()
      for (const stdio of ['stdout', 'stderr']) {
        // stream[stdio].flush();
        // process[stdio].flush()
      }
      for (const stdio in stream) {
        // await fs.remove(context[stdio]);
        // stream[stdio].flush();
        // process[stdio].flush();
        stream[stdio].destroy();
      }
      stream.stdin.destroy();
      for (const file of ['stdout', 'stderr', 'stdin', 'exit']) {
        await fs.remove(context[file]);
      }
      process.stdin.destroy();
      if (exitCode) throw `Exited with error code '${exitCode}'`;
    }
  });

  $run = CLI.command({
    command: '$run',
    handler: async function $run() {
      try {
        const context = await this.read();
        try {
          // console.log({ context });
          await fs.remove(this.lockfile);
          const stream = {};
          for (const stdio of ['stdout', 'stderr']) {
            stream[stdio] = fs.createWriteStream(context[stdio]);
          }
          stream.stdin = await readUntilDeleted(context.stdin);
          const cp = this.spawn(context.command, {
            stdio: 'pipe',
            // stdio: ['inherit', 'pipe', 'pipe'],
            detached: true,
          });
          for (const stdio of ['stdout', 'stderr']) {
            if (!cp[stdio]) continue;
            cp[stdio].pipe(stream[stdio]);
            cp[stdio].pipe(process[stdio]);
          }
          stream.stdin.pipe(cp.stdin);
          cp.on('exit', code => {
            // stream.stdin.flush();
            stream.stdin.destroy();
            for (const stdio of ['stdout', 'stderr']) {
              if (!cp[stdio]) continue;
              // cp[stdio].flush();
              // cp[stdio].flush();
            }
            for (const stdio of ['stdout', 'stderr', 'stdin']) {
              stream[stdio].destroy();
              cp[stdio].destroy();
            }
            // fs.removeSync(context.stdin);
            // console.log('???');
            // for (const stdio in write) {
            //   write[stdio].destroy();
            // }
            fs.writeFileSync(context.exit, code || '');
          });
        } catch (error) {
          console.error(error);
          fs.writeFileSync(context.stderr, error.stack);
          setTimeout(() => {}, 10 * 1000);
        }
      } catch (error) {
        console.error(error);
        setTimeout(() => {}, 10 * 1000);
      } finally {
        // setTimeout(() => {}, 10 * 1000);
      }
    }
  });

  write(data) {
    return fs.writeFile(this.lockfile, JSON.stringify(data, null, 2));
  }
  async read() {
    return JSON.parse(await fs.readFile(this.lockfile, 'utf8'));
  }

  spawn(cmd, opts) {
    if (typeof cmd === 'string') cmd = cmd.split(/[ ]+/);
    const [command, ...args] = cmd;
    // console.log('Running', command, ...args);
    // return;
    const cp = CP.spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...opts,
    });
    const stdio = { stdout: null, stderr: null };
    for (const key in stdio) {
      if (!cp[key]) continue;
      cp[key].on('data', data => stdio[key] = (stdio[key] || '') + String(data));
    }
    const promise = new Promise((resolve, reject) => {
      cp.on('exit', code => {
        if (code) {
          reject(stdio.stderr || `Exited with error code '${code}'`);
        } else {
          resolve(stdio);
        }
      });
    });
    cp.then = promise.then.bind(promise);
    cp.catch = promise.catch.bind(promise);
    return cp;
  }

  delay(n = 1000) { return new Promise(x => setTimeout(x, n)) }

}

const winSudo = new WinSudo;
module.exports = winSudo;
if (!module.parent) CLI.run(winSudo).catch(console.error);
