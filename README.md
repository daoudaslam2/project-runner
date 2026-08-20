# Project Runner

Project Runner is a small VS Code extension for adding simple project action buttons to VS Code.

It gives you separate buttons for VS Code run, VS Code debug, and an optional custom terminal command. The custom command is project-based instead of file-based, so it runs from the workspace folder or from the custom working directory you configure.

## Features

- Show a `Run Project` button that starts VS Code run-without-debugging.
- Show a `Debug Project` button that starts VS Code debugging.
- Show a `Run Command` button only when a custom command is configured.
- Show a `Stop Project` button while a custom command or VS Code debug/run session is active.
- Hide run, debug, and command buttons while a custom command or VS Code debug/run session is active.
- Use the same actions from the Command Palette.
- Control run and debug buttons independently with boolean settings.
- Keep the custom command empty by default, so no extra command button appears until you need one.
- Configure a custom command from VS Code with `Project Runner: Configure Run Command`.
- Save command settings per workspace, so different projects can use different commands.
- Run custom commands from the workspace root or a configured subfolder.
- Reuse the same terminal for custom command runs.
- Customize the terminal name.
- Control each bottom status bar button separately.

## Why Project Runner?

Many run buttons are tied to the active file. That works for scripts, but it is not ideal for real projects where you may want one-click VS Code run/debug actions plus a separate project command like `npm run dev`, `python -m uvicorn main:app --reload`, `docker compose up`, or something else entirely.

Project Runner keeps those actions separate, so you can show only the buttons that make sense for each workspace.

## Commands

| Command | Description |
| --- | --- |
| `Project Runner: Run Project` | Starts VS Code run-without-debugging. |
| `Project Runner: Debug Project` | Starts VS Code debugging. |
| `Project Runner: Run Command` | Runs `projectRunner.action.command` in a VS Code terminal. |
| `Project Runner: Stop Project` | Stops the active custom command or VS Code debug/run session. For custom commands, it sends Ctrl+C to the terminal. |
| `Project Runner: Configure Run Command` | Prompts for a command and saves it to the current workspace settings. |

## UI Buttons

Project Runner adds two ways to run your project without opening the Command Palette:

| Location | Button |
| --- | --- |
| Bottom status bar | `Run Project`, `Debug Project`, `Run Command`, `Stop Project`, or any combination |
| Editor title toolbar | Play icon, debug icon, command icon, or stop icon |

The editor title toolbar button appears near the top-right editor actions. VS Code does not allow extensions to place arbitrary custom buttons directly in the main app title bar, so this is the closest native top-area location.

## Default Behavior

By default, Project Runner shows the VS Code run and debug actions:

```json
{
  "projectRunner.action.run": true,
  "projectRunner.action.debug": true,
  "projectRunner.action.command": "",
  "projectRunner.statusBar.showRun": true,
  "projectRunner.statusBar.showDebug": false,
  "projectRunner.statusBar.showCommand": false,
  "projectRunner.statusBar.showStopCommand": true
}
```

By default, only the run action appears in the bottom status bar. The debug and custom command actions still appear in the editor title toolbar when enabled.

Because `projectRunner.action.command` is empty by default, the custom command button is hidden until you set a command. To also show it in the bottom status bar, set `projectRunner.statusBar.showCommand` to `true`.

## Extension Settings

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `projectRunner.cwd` | string | empty | Optional working directory. Relative paths are resolved from the workspace folder. |
| `projectRunner.terminalName` | string | `Project Runner` | Name of the VS Code terminal used by the extension. |
| `projectRunner.action.run` | boolean | `true` | Shows the run action, which starts VS Code run-without-debugging. |
| `projectRunner.action.debug` | boolean | `true` | Shows the debug action, which starts VS Code debugging. |
| `projectRunner.action.command` | string | empty | Optional terminal command. When empty, the command button is hidden. |
| `projectRunner.statusBar.showRun` | boolean | `true` | Shows the run action in the bottom status bar. |
| `projectRunner.statusBar.showDebug` | boolean | `false` | Shows the debug action in the bottom status bar. |
| `projectRunner.statusBar.showCommand` | boolean | `false` | Shows the custom command action in the bottom status bar when `projectRunner.action.command` is set. |
| `projectRunner.statusBar.showStopCommand` | boolean | `true` | Shows the stop action in the bottom status bar while a Project Runner action is running. |

## Example Configurations

Add these to your workspace `.vscode/settings.json`, or use `Project Runner: Configure Run Command` for the command value.

### Node.js or React

```json
{
  "projectRunner.action.command": "npm run dev"
}
```

### FastAPI

```json
{
  "projectRunner.action.command": "python -m uvicorn main:app --reload"
}
```

### Docker Compose

```json
{
  "projectRunner.action.command": "docker compose up"
}
```

### Start VS Code Debugging

```json
{
  "projectRunner.action.debug": true
}
```

### Show Both Run and Debug Buttons

```json
{
  "projectRunner.action.run": true,
  "projectRunner.action.debug": true,
  "projectRunner.statusBar.showRun": true,
  "projectRunner.statusBar.showDebug": true
}
```

### Hide Debug Button

```json
{
  "projectRunner.action.debug": false
}
```

### Hide Run Button

```json
{
  "projectRunner.action.run": false
}
```

### Show a Custom Command Button

```json
{
  "projectRunner.action.command": "npm run dev",
  "projectRunner.statusBar.showCommand": true
}
```

### Hide Stop Button in Status Bar

```json
{
  "projectRunner.statusBar.showStopCommand": false
}
```

### Project With a Subfolder

```json
{
  "projectRunner.cwd": "folder-name-or-path",
  "projectRunner.action.command": "python -m uvicorn main:app --reload",
  "projectRunner.terminalName": "Backend Server"
}
```

## How It Works

For VS Code run and debug actions, Project Runner delegates to VS Code's built-in run/debug commands. It also listens for VS Code debug/run sessions started outside Project Runner, such as from the menu, keyboard shortcuts, or the Run and Debug panel.

For custom command actions:

1. Project Runner finds the current workspace folder.
2. It reads the workspace settings.
3. It checks whether `projectRunner.action.command` has text.
4. It resolves `projectRunner.cwd`.
5. It opens or reuses a terminal.
6. It sends `projectRunner.action.command` to that terminal.

If you have multiple workspace folders open, Project Runner uses the folder for the active editor when possible. If it cannot infer the folder, VS Code asks you to choose one.

## Roadmap

- Better custom command lifecycle detection.
- Multiple named run commands.
- Sidebar view for project actions.

## Release Notes

### 0.0.1

Initial Project Runner release with:

- VS Code run and debug action buttons.
- Optional custom terminal command button.
- Command Palette actions.
- Bottom status bar buttons.
- Editor title toolbar buttons.
- Workspace-aware command execution.
