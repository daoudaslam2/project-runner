# Universal Project Runner

Universal Project Runner is a small VS Code-compatible extension for adding project action buttons to your editor.

It gives you separate actions for VS Code run, VS Code debug, and named terminal commands. Terminal commands are project-based instead of file-based, so they run from the workspace folder or from the command-specific working directory you configure.

## Features

- Show a `Run Project` action that starts VS Code run-without-debugging.
- Show a `Debug Project` action that starts VS Code debugging.
- Show a `Run Command` action when at least one named command is configured.
- Support multiple named project commands in one workspace.
- Show a command dropdown when more than one command is configured.
- Run a single configured command directly without a picker.
- Give each command its own `cwd`.
- Show a `Stop Project` action while a custom command or VS Code debug/run session is active.
- Hide run, debug, and command actions while a custom command or VS Code debug/run session is active.
- Use the same actions from the Command Palette.
- Control run and debug actions independently with boolean settings.
- Keep custom commands empty by default, so no extra command action appears until you need one.
- Configure named commands from VS Code with `Universal Project Runner: Configure Run Command`.
- Save command settings per workspace, so different projects can use different commands.
- Reuse terminals for command runs.
- Customize the base terminal name.
- Control bottom status bar run/debug buttons separately.

## Why Universal Project Runner?

Many run buttons are tied to the active file. That works for scripts, but it is not ideal for real projects where you may want one-click VS Code run/debug actions plus project commands like `npm run dev`, `python -m uvicorn main:app --reload`, `docker compose up`, or separate frontend/backend commands.

Universal Project Runner keeps those actions separate, so you can show only the buttons that make sense for each workspace.

## Commands

| Command | Description |
| --- | --- |
| `Universal Project Runner: Run Project` | Starts VS Code run-without-debugging. |
| `Universal Project Runner: Debug Project` | Starts VS Code debugging. |
| `Universal Project Runner: Run Command` | Runs a configured item from `universalProjectRunner.commands` in a VS Code terminal. |
| `Universal Project Runner: Stop Project` | Stops the active custom command or VS Code debug/run session. For custom commands, it sends Ctrl+C to the terminal. |
| `Universal Project Runner: Configure Run Command` | Adds or updates a named workspace command. |

## UI Buttons

Universal Project Runner adds two ways to run your project without opening the Command Palette:

| Location | Button |
| --- | --- |
| Bottom status bar | `Run Project`, `Debug Project`, or both |
| Editor title toolbar | Play icon, debug icon, command icon, command dropdown, or stop icon |

The editor title toolbar button appears near the top-right editor actions. VS Code-compatible editors do not allow extensions to place arbitrary custom buttons directly in the main app title bar, so this is the closest native top-area location.

## Default Behavior

By default, Universal Project Runner shows the VS Code run and debug actions:

```json
{
  "universalProjectRunner.action.run": true,
  "universalProjectRunner.action.debug": true,
  "universalProjectRunner.commands": [],
  "universalProjectRunner.statusBar.showRun": true,
  "universalProjectRunner.statusBar.showDebug": false
}
```

By default, only the run action appears in the bottom status bar. The debug action still appears in the editor title toolbar when enabled.

Because `universalProjectRunner.commands` is empty by default, the custom command button is hidden until you add at least one command. With one command, the editor title toolbar runs it directly. With two or more commands, the editor title toolbar shows a dropdown action that lets you choose the command name.

## How It Works

For VS Code run and debug actions, Universal Project Runner delegates to VS Code's built-in run/debug commands. It also listens for VS Code debug/run sessions started outside Universal Project Runner, such as from the menu, keyboard shortcuts, or the Run and Debug panel.

> **Important:** VS Code run/debug actions use the editor's built-in project launch configuration. If your project does not have one yet, create `.vscode/launch.json` once from the Run and Debug view, then Universal Project Runner can reuse it through the run and debug actions.
>
> Use `Run Project` and `Debug Project` when your project works with the default framework launch setup. Use named commands when your project needs custom run commands, environment variables, ports, subfolders, Docker commands, or separate frontend/backend processes.

For custom command actions:

1. Universal Project Runner finds the current workspace folder.
2. It reads `universalProjectRunner.commands`.
3. It runs the only command directly, or shows a command picker when multiple commands exist.
4. It resolves the selected command's `cwd`.
5. It opens or reuses a terminal for that workspace command.
6. It sends the selected command text to that terminal.

If you have multiple workspace folders open, Universal Project Runner uses the folder for the active editor when possible. If it cannot infer the folder, the editor asks you to choose one.

## Extension Settings

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `universalProjectRunner.terminalName` | string | `Universal Project Runner` | Base name of the VS Code terminal used by the extension. |
| `universalProjectRunner.action.run` | boolean | `true` | Shows the run action, which starts VS Code run-without-debugging. |
| `universalProjectRunner.action.debug` | boolean | `true` | Shows the debug action, which starts VS Code debugging. |
| `universalProjectRunner.commands` | array | `[]` | Named terminal commands. Each item has `name`, `cwd`, and `command`. |
| `universalProjectRunner.statusBar.showRun` | boolean | `true` | Shows the run action in the bottom status bar. |
| `universalProjectRunner.statusBar.showDebug` | boolean | `false` | Shows the debug action in the bottom status bar. |

## Command Items

Each item in `universalProjectRunner.commands` supports:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Name shown in the command picker. |
| `cwd` | string | no | Optional working directory. Relative paths are resolved from the workspace folder. |
| `command` | string | yes | Terminal command to run. |

## Example Configurations

Add these to your workspace `.vscode/settings.json`, or use `Universal Project Runner: Configure Run Command`.

### Node.js or React

```json
{
  "universalProjectRunner.commands": [
    {
      "name": "Dev Server",
      "cwd": "",
      "command": "npm run dev"
    }
  ]
}
```

### FastAPI

```json
{
  "universalProjectRunner.commands": [
    {
      "name": "FastAPI",
      "cwd": "",
      "command": "python -m uvicorn main:app --reload"
    }
  ]
}
```

### Docker Compose

```json
{
  "universalProjectRunner.commands": [
    {
      "name": "Docker Compose",
      "cwd": "",
      "command": "docker compose up"
    }
  ]
}
```

### Frontend and Backend in One Workspace

```json
{
  "universalProjectRunner.commands": [
    {
      "name": "Frontend",
      "cwd": "frontend",
      "command": "npm run dev"
    },
    {
      "name": "Backend",
      "cwd": "backend",
      "command": "python -m uvicorn main:app --reload"
    }
  ]
}
```

### Show Both Run and Debug Buttons

```json
{
  "universalProjectRunner.action.run": true,
  "universalProjectRunner.action.debug": true,
  "universalProjectRunner.statusBar.showRun": true,
  "universalProjectRunner.statusBar.showDebug": true
}
```

### Hide Debug Button

```json
{
  "universalProjectRunner.action.debug": false
}
```

### Hide Run Button

```json
{
  "universalProjectRunner.action.run": false
}
```

## Migrating from Project Runner Settings

Version `0.2.0` replaces the old `projectRunner.*` settings with `universalProjectRunner.*` settings.

Old single-command settings are no longer used:

```json
{
  "projectRunner.cwd": "backend",
  "projectRunner.action.command": "npm run dev"
}
```

Use named commands instead:

```json
{
  "universalProjectRunner.commands": [
    {
      "name": "Backend",
      "cwd": "backend",
      "command": "npm run dev"
    }
  ]
}
```

## Roadmap

- Better custom command lifecycle detection.
- Sidebar view for project actions.

## Release Notes

### 0.2.0

- Renamed settings from `projectRunner.*` to `universalProjectRunner.*`.
- Replaced the old single command setting with `universalProjectRunner.commands`.
- Added multiple named terminal commands with per-command working directories.
- Added a command dropdown when multiple commands are configured.

### 0.0.1

Initial Project Runner release with:

- VS Code run and debug action buttons.
- Optional custom terminal command button.
- Command Palette actions.
- Bottom status bar buttons.
- Editor title toolbar buttons.
- Workspace-aware command execution.
