# Project Runner

Run the current VS Code workspace project from a command palette action or a status bar button.

## Features

- `Project Runner: Run Project` runs the configured project command from the workspace folder.
- `Project Runner: Configure Run Command` saves a workspace command without editing JSON by hand.
- A `Run Project` status bar button runs the same command.

The command is project-level, not file-level, so it works no matter which file is currently open.

## Extension Settings

- `projectRunner.command`: command used to run the project. Default: `npm run dev`.
- `projectRunner.cwd`: optional working directory. Relative paths are resolved from the workspace folder.
- `projectRunner.terminalName`: terminal name used by the extension.
- `projectRunner.showStatusBarButton`: show or hide the status bar button.

## Requirements

Your configured command must be available in the selected workspace. For example:

```json
{
  "projectRunner.command": "npm run dev"
}
```

For a FastAPI project, you might use:

```json
{
  "projectRunner.command": "python -m uvicorn main:app --reload"
}
```

## Development

Run `npm run compile`, then press `F5` in VS Code to open an Extension Development Host.

## Known Issues

No stop/debug buttons yet. Those are planned after the first run command is stable.

## Release Notes

### 0.0.1

Initial Project Runner command and status bar button.
