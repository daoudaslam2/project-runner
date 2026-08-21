# Change Log

All notable changes to Universal Project Runner are documented here.

## 0.2.0

- Renamed settings from `projectRunner.*` to `universalProjectRunner.*`.
- Replaced the old single custom command setting with `universalProjectRunner.commands`.
- Added support for multiple named terminal commands.
- Added per-command working directories.
- Added command picking when multiple commands are configured.
- Added a one-time warning when old `projectRunner.*` settings are detected.
- Removed the bottom status bar stop button and related setting.
- Removed the bottom status bar command button and related setting.
- Added an editor title command dropdown for workspaces with multiple named commands.

## 0.1.2

- Lowered the VS Code engine requirement to support editors based on VS Code OSS `1.107.0`.

## 0.1.1

- Renamed the extension to Universal Project Runner.
- Updated Marketplace package metadata and repository links.

## 0.1.0

- Added extension logo and Marketplace metadata.
- Added repository contribution safeguards.

## 0.0.1

- Initial release with run, debug, custom command, stop, status bar, and editor title actions.
