# Project Runner

Project Runner is a small VS Code extension for running the current workspace project with one configurable command.

It is intentionally project-based instead of file-based. No matter which file is currently open, Project Runner runs the command from the workspace folder or from the custom working directory you configure.

## Features

- Run any project command from VS Code.
- Use the Command Palette command `Project Runner: Run Project`.
- Click the `Run Project` button in the bottom status bar.
- Click the play button in the editor title toolbar.
- Configure the run command from VS Code with `Project Runner: Configure Run Command`.
- Save commands per workspace, so different projects can use different run commands.
- Run from the workspace root or a configured subfolder.
- Reuse the same terminal for the same workspace.
- Customize the terminal name.
- Hide the bottom status bar button if you only want the top toolbar or Command Palette action.

## Why Project Runner?

Many run buttons are tied to the active file. That works for scripts, but it is not ideal for real projects where the correct command might be `npm run dev`, `python -m uvicorn main:app --reload`, `docker compose up`, or something else entirely.

Project Runner lets the project decide what "run" means.

## Commands

| Command | Description |
| --- | --- |
| `Project Runner: Run Project` | Runs the configured project command in a VS Code terminal. |
| `Project Runner: Configure Run Command` | Prompts for a command and saves it to the current workspace settings. |

## UI Buttons

Project Runner adds two ways to run your project without opening the Command Palette:

| Location | Button |
| --- | --- |
| Bottom status bar | `Run Project` |
| Editor title toolbar | Play icon |

The editor title toolbar button appears near the top-right editor actions. VS Code does not allow extensions to place arbitrary custom buttons directly in the main app title bar, so this is the closest native top-area location.

## Extension Settings

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `projectRunner.command` | string | `npm run dev` | Command used to run the current workspace project. |
| `projectRunner.cwd` | string | empty | Optional working directory. Relative paths are resolved from the workspace folder. |
| `projectRunner.terminalName` | string | `Project Runner` | Name of the VS Code terminal used by the extension. |
| `projectRunner.showStatusBarButton` | boolean | `true` | Shows or hides the bottom status bar button. |

## Example Configurations

Add these to your workspace `.vscode/settings.json`, or use `Project Runner: Configure Run Command` for the command value.

### Node.js or React

```json
{
  "projectRunner.command": "npm run dev"
}
```

### FastAPI

```json
{
  "projectRunner.command": "python -m uvicorn main:app --reload"
}
```

### Docker Compose

```json
{
  "projectRunner.command": "docker compose up"
}
```

### Project With a Frontend Subfolder

```json
{
  "projectRunner.cwd": "frontend",
  "projectRunner.command": "npm run dev",
  "projectRunner.terminalName": "Frontend Dev Server"
}
```

### Project With a Backend Subfolder

```json
{
  "projectRunner.cwd": "backend",
  "projectRunner.command": "python -m uvicorn main:app --reload",
  "projectRunner.terminalName": "Backend Server"
}
```

## How It Works

1. Project Runner finds the current workspace folder.
2. It reads the workspace settings.
3. It resolves `projectRunner.cwd`.
4. It opens or reuses a terminal.
5. It sends `projectRunner.command` to that terminal.

If you have multiple workspace folders open, Project Runner uses the folder for the active editor when possible. If it cannot infer the folder, VS Code asks you to choose one.

## Installation

For local development builds, package the extension as a VSIX:

```bash
npx @vscode/vsce package
```

Then install it:

```bash
code --install-extension project-runner-0.0.1.vsix --force
```

Reload VS Code after installing:

```text
Cmd + Shift + P -> Developer: Reload Window
```

## Requirements

Your configured command must be available in the selected workspace terminal.

For example, if you configure `npm run dev`, the workspace should have a `package.json` script named `dev`. If you configure a Python command, Python and the required packages must be available in the terminal environment.

## Development

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run compile
```

Lint:

```bash
npm run lint
```

Run in development:

1. Open this repository in VS Code.
2. Press `F5`.
3. A new Extension Development Host window opens.
4. Open a project folder in that window.
5. Run `Project Runner: Run Project`.

## Known Issues

- Stop and debug buttons are not available yet.
- Only one run command is supported per workspace.
- The command is sent to a terminal; Project Runner does not currently manage process lifecycle beyond terminal reuse.

## Roadmap

- Stop button.
- Debug button.
- Multiple named run commands.
- Project command detection for common frameworks.
- Sidebar view for project actions.

## Release Notes

### 0.0.1

Initial Project Runner release with:

- Configurable project run command.
- Command Palette commands.
- Bottom status bar button.
- Editor title toolbar play button.
- Workspace-aware command execution.
