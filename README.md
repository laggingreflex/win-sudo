# win-sudo

Uses [Task Scheduler] to run any command as administrator on Windows.

**Note**: See [caveats](#caveats) for associated **risks**.

## Install

```
npm i -g win-sudo
```

## Usage

First time: Register from an elevated prompt:

```
sudo $register
```

This will create a new [Scheduled Task][Task Scheduler] "win-sudo" with HIGHEST Run Level.

Subsequently, from any (un-elevated) prompt:

```
sudo command-you-want-to-run with args
```

This will run the task "win-sudo" which will run the specified command.

## Caveats

* **DANGER**: **It will \*never\* ask for a \*password\***. Any program/command will be able to use this feature to carry out commands with elevated privileges.

* It stores the command that needs to be run temporarily in a lockfile. So some use-cases may not be ideal for this (like running a lot of parallel commands at once).

* It stores and relays input/output from the task to current prompt via (unique) temporary files.

* It's not perfect. Issues/PRs most welcome.

[Task Scheduler]: https://en.wikipedia.org/wiki/Windows_Task_Scheduler
