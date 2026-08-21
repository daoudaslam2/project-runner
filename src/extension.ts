import * as vscode from 'vscode';
import * as path from 'path';

const terminalByWorkspace = new Map<string, vscode.Terminal>();
const nativeDebugSessions = new Set<vscode.DebugSession>();
let runningCommandTerminal: vscode.Terminal | undefined;
let nativeActionRunning = false;

type RunnerCommand = {
	name: string;
	command: string;
	cwd: string;
};

type RunnerConfig = {
	commands: RunnerCommand[];
	terminalName: string;
	actionRun: boolean;
	actionDebug: boolean;
	statusBarShowRun: boolean;
	statusBarShowDebug: boolean;
};

export function activate(context: vscode.ExtensionContext) {
	void warnAboutLegacySettings(context);

	const runStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	runStatusBarItem.command = 'project-runner.runProject';
	runStatusBarItem.text = '$(play) Run Project';
	runStatusBarItem.tooltip = 'Run the current workspace project';

	const debugStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
	debugStatusBarItem.command = 'project-runner.debugProject';
	debugStatusBarItem.text = '$(debug-alt) Debug Project';
	debugStatusBarItem.tooltip = 'Start VS Code debugging';

	updateActionVisibility(runStatusBarItem, debugStatusBarItem);

	const startRunning = createNativeDebugAction(
		'workbench.action.debug.run',
		runStatusBarItem,
		debugStatusBarItem
	);

	const startDebugging = createNativeDebugAction(
		'workbench.action.debug.start',
		runStatusBarItem,
		debugStatusBarItem
	);

	const runProject = vscode.commands.registerCommand('project-runner.runProject', startRunning);

	const debugProject = vscode.commands.registerCommand('project-runner.debugProject', startDebugging);

	const runConfiguredCommand = async (forcePick: boolean) => {
		const workspaceFolder = await pickWorkspaceFolder();
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('Open a project folder before running a Project Runner command.');
			return;
		}

		const config = getRunnerConfig(workspaceFolder);
		if (config.commands.length === 0) {
			vscode.window.showErrorMessage('Set universalProjectRunner.commands before running a command.');
			return;
		}

		const command = await pickRunnerCommand(config.commands, forcePick);
		if (!command) {
			return;
		}

		const cwd = resolveCwd(workspaceFolder, command.cwd);
		const terminal = getOrCreateTerminal(workspaceFolder, config.terminalName, command, cwd);
		terminal.show();
		terminal.sendText(command.command);
		if (config.commands.length === 1) {
			runningCommandTerminal = terminal;
			updateActionVisibility(runStatusBarItem, debugStatusBarItem);
		}
	};

	const runCommand = vscode.commands.registerCommand('project-runner.runCommand', () => runConfiguredCommand(false));

	const pickCommand = vscode.commands.registerCommand('project-runner.pickCommand', () => runConfiguredCommand(true));

	const stopCommand = vscode.commands.registerCommand('project-runner.stopCommand', async () => {
		if (!runningCommandTerminal && !nativeActionRunning && nativeDebugSessions.size === 0) {
			vscode.window.showInformationMessage('No Project Runner action is running.');
			return;
		}

		if (runningCommandTerminal) {
			runningCommandTerminal.show();
			runningCommandTerminal.sendText('\u0003', false);
			runningCommandTerminal = undefined;
		}

		const shouldStopNativeAction = nativeActionRunning || nativeDebugSessions.size > 0;
		await Promise.all([...nativeDebugSessions].map((session) => vscode.debug.stopDebugging(session)));
		nativeDebugSessions.clear();
		if (shouldStopNativeAction) {
			await vscode.commands.executeCommand('workbench.action.debug.stop');
			nativeActionRunning = false;
		}
		updateActionVisibility(runStatusBarItem, debugStatusBarItem);
	});

	const configureCommand = vscode.commands.registerCommand('project-runner.configureCommand', async () => {
		const workspaceFolder = await pickWorkspaceFolder();
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('Open a project folder before configuring Project Runner.');
			return;
		}

		const config = getRunnerConfig(workspaceFolder);
		const pickedCommand = await pickCommandToConfigure(config.commands);
		if (pickedCommand === undefined) {
			return;
		}

		const currentCommand = pickedCommand === null ? undefined : pickedCommand;
		const name = await vscode.window.showInputBox({
			title: 'Universal Project Runner Command Name',
			prompt: 'Name shown in the command picker',
			value: currentCommand?.name ?? '',
			ignoreFocusOut: true
		});

		if (name === undefined) {
			return;
		}

		const command = await vscode.window.showInputBox({
			title: 'Universal Project Runner Command',
			prompt: 'Command to run',
			value: currentCommand?.command ?? '',
			ignoreFocusOut: true
		});

		if (command === undefined) {
			return;
		}

		const cwd = await vscode.window.showInputBox({
			title: 'Universal Project Runner Working Directory',
			prompt: 'Optional working directory. Relative paths are resolved from the workspace folder.',
			value: currentCommand?.cwd ?? '',
			ignoreFocusOut: true
		});

		if (cwd === undefined) {
			return;
		}

		const nextCommand = {
			name: name.trim() || command.trim(),
			command: command.trim(),
			cwd: cwd.trim()
		};

		if (!nextCommand.command) {
			vscode.window.showErrorMessage('Command cannot be empty.');
			return;
		}

		const nextCommands = currentCommand
			? config.commands.map((item) => (item === currentCommand ? nextCommand : item))
			: [...config.commands, nextCommand];

		await vscode.workspace.getConfiguration('universalProjectRunner', workspaceFolder.uri).update(
			'commands',
			nextCommands,
			vscode.ConfigurationTarget.Workspace
		);

		updateActionVisibility(runStatusBarItem, debugStatusBarItem);
		vscode.window.showInformationMessage(`Universal Project Runner command saved: ${nextCommand.name}`);
	});

	const terminalClose = vscode.window.onDidCloseTerminal((terminal) => {
		for (const [workspacePath, knownTerminal] of terminalByWorkspace.entries()) {
			if (knownTerminal === terminal) {
				terminalByWorkspace.delete(workspacePath);
			}
		}

		if (runningCommandTerminal === terminal) {
			runningCommandTerminal = undefined;
			updateActionVisibility(runStatusBarItem, debugStatusBarItem);
		}
	});

	const debugStart = vscode.debug.onDidStartDebugSession((session) => {
		nativeActionRunning = true;
		nativeDebugSessions.add(session);
		updateActionVisibility(runStatusBarItem, debugStatusBarItem);
	});

	const debugTerminate = vscode.debug.onDidTerminateDebugSession((session) => {
		if (nativeDebugSessions.delete(session)) {
			nativeActionRunning = nativeDebugSessions.size > 0;
			updateActionVisibility(runStatusBarItem, debugStatusBarItem);
		}
	});

	const configChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (
			event.affectsConfiguration('universalProjectRunner.action.run') ||
			event.affectsConfiguration('universalProjectRunner.action.debug') ||
			event.affectsConfiguration('universalProjectRunner.commands') ||
			event.affectsConfiguration('universalProjectRunner.statusBar.showRun') ||
			event.affectsConfiguration('universalProjectRunner.statusBar.showDebug')
		) {
			updateActionVisibility(runStatusBarItem, debugStatusBarItem);
		}
	});

	context.subscriptions.push(
		runProject,
		debugProject,
		runCommand,
		pickCommand,
		stopCommand,
		configureCommand,
		terminalClose,
		debugStart,
		debugTerminate,
		configChange,
		runStatusBarItem,
		debugStatusBarItem
	);
}

export function deactivate() {}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		return undefined;
	}

	if (folders.length === 1) {
		return folders[0];
	}

	const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;
	const activeFolder = activeDocumentUri ? vscode.workspace.getWorkspaceFolder(activeDocumentUri) : undefined;
	if (activeFolder) {
		return activeFolder;
	}

	return vscode.window.showWorkspaceFolderPick({
		placeHolder: 'Choose the workspace folder to run'
	});
}

function getRunnerConfig(workspaceFolder: vscode.WorkspaceFolder): RunnerConfig {
	const config = vscode.workspace.getConfiguration('universalProjectRunner', workspaceFolder.uri);

	return {
		commands: normalizeRunnerCommands(config.get('commands', [])),
		terminalName: config.get('terminalName', 'Universal Project Runner'),
		actionRun: config.get('action.run', true),
		actionDebug: config.get('action.debug', true),
		statusBarShowRun: config.get('statusBar.showRun', true),
		statusBarShowDebug: config.get('statusBar.showDebug', false)
	};
}

function getGlobalRunnerConfig(): Pick<
	RunnerConfig,
	| 'actionRun'
	| 'actionDebug'
	| 'commands'
	| 'statusBarShowRun'
	| 'statusBarShowDebug'
> {
	const config = vscode.workspace.getConfiguration('universalProjectRunner');

	return {
		actionRun: config.get('action.run', true),
		actionDebug: config.get('action.debug', true),
		commands: normalizeRunnerCommands(config.get('commands', [])),
		statusBarShowRun: config.get('statusBar.showRun', true),
		statusBarShowDebug: config.get('statusBar.showDebug', false)
	};
}

function resolveCwd(workspaceFolder: vscode.WorkspaceFolder, configuredCwd: string): string {
	if (!configuredCwd.trim()) {
		return workspaceFolder.uri.fsPath;
	}

	if (path.isAbsolute(configuredCwd)) {
		return configuredCwd;
	}

	return path.join(workspaceFolder.uri.fsPath, configuredCwd);
}

function getOrCreateTerminal(
	workspaceFolder: vscode.WorkspaceFolder,
	terminalName: string,
	command: RunnerCommand,
	cwd: string
): vscode.Terminal {
	const terminalKey = `${workspaceFolder.uri.fsPath}:${command.name}`;
	const existingTerminal = terminalByWorkspace.get(terminalKey);
	if (existingTerminal) {
		return existingTerminal;
	}

	const terminal = vscode.window.createTerminal({
		name: `${terminalName}: ${command.name}`,
		cwd
	});

	terminalByWorkspace.set(terminalKey, terminal);
	return terminal;
}

function createNativeDebugAction(
	command: string,
	runStatusBarItem: vscode.StatusBarItem,
	debugStatusBarItem: vscode.StatusBarItem
): () => Promise<void> {
	return async () => {
		nativeActionRunning = true;
		updateActionVisibility(runStatusBarItem, debugStatusBarItem);

		try {
			await vscode.commands.executeCommand(command);
		} catch (error) {
			nativeActionRunning = false;
			updateActionVisibility(runStatusBarItem, debugStatusBarItem);
			throw error;
		}
	};
}

function updateActionVisibility(
	runStatusBarItem: vscode.StatusBarItem,
	debugStatusBarItem: vscode.StatusBarItem
): void {
	const config = getGlobalRunnerConfig();
	const singleCommandAction = config.commands.length === 1;
	const multipleCommandActions = config.commands.length > 1;
	const commandRunning = Boolean(runningCommandTerminal || nativeActionRunning || nativeDebugSessions.size);

	void vscode.commands.executeCommand('setContext', 'universalProjectRunner.action.run', config.actionRun);
	void vscode.commands.executeCommand('setContext', 'universalProjectRunner.action.debug', config.actionDebug);
	void vscode.commands.executeCommand('setContext', 'universalProjectRunner.hasCommandAction', singleCommandAction || multipleCommandActions);
	void vscode.commands.executeCommand('setContext', 'universalProjectRunner.hasSingleCommandAction', singleCommandAction);
	void vscode.commands.executeCommand('setContext', 'universalProjectRunner.hasMultipleCommandActions', multipleCommandActions);
	void vscode.commands.executeCommand('setContext', 'universalProjectRunner.commandRunning', commandRunning);

	if (config.statusBarShowRun && config.actionRun && !commandRunning) {
		runStatusBarItem.show();
	} else {
		runStatusBarItem.hide();
	}

	if (config.statusBarShowDebug && config.actionDebug && !commandRunning) {
		debugStatusBarItem.show();
	} else {
		debugStatusBarItem.hide();
	}
}

function normalizeRunnerCommands(commands: unknown): RunnerCommand[] {
	if (!Array.isArray(commands)) {
		return [];
	}

	return commands
		.map((item, index) => {
			if (!item || typeof item !== 'object') {
				return undefined;
			}

			const record = item as Record<string, unknown>;
			const command = typeof record.command === 'string' ? record.command.trim() : '';
			if (!command) {
				return undefined;
			}

			const name = typeof record.name === 'string' && record.name.trim()
				? record.name.trim()
				: `Command ${index + 1}`;
			const cwd = typeof record.cwd === 'string' ? record.cwd.trim() : '';

			return { name, command, cwd };
		})
		.filter((command): command is RunnerCommand => Boolean(command));
}

async function pickRunnerCommand(commands: RunnerCommand[], forcePick = false): Promise<RunnerCommand | undefined> {
	if (!forcePick && commands.length <= 1) {
		return commands[0];
	}

	return vscode.window.showQuickPick(
		commands.map((command) => ({
			label: command.name,
			description: command.cwd || 'workspace root',
			detail: command.command,
			command
		})),
		{
			placeHolder: 'Choose a command to run'
		}
	).then((item) => item?.command);
}

async function pickCommandToConfigure(commands: RunnerCommand[]): Promise<RunnerCommand | null | undefined> {
	if (!commands.length) {
		return null;
	}

	const picked = await vscode.window.showQuickPick(
		[
			{
				label: 'Add new command',
				description: 'Create another workspace command',
				command: null
			},
			...commands.map((command) => ({
				label: command.name,
				description: command.cwd || 'workspace root',
				detail: command.command,
				command
			}))
		],
		{
			placeHolder: 'Choose a command to configure'
		}
	);

	return picked?.command;
}

async function warnAboutLegacySettings(context: vscode.ExtensionContext): Promise<void> {
	if (context.globalState.get('legacyProjectRunnerSettingsWarningShown', false)) {
		return;
	}

	const legacyConfig = vscode.workspace.getConfiguration('projectRunner');
	const hasLegacySettings = Boolean(
		legacyConfig.inspect('cwd') ||
		legacyConfig.inspect('terminalName') ||
		legacyConfig.inspect('action.run') ||
		legacyConfig.inspect('action.debug') ||
		legacyConfig.inspect('action.command') ||
		legacyConfig.inspect('statusBar.showRun') ||
		legacyConfig.inspect('statusBar.showDebug') ||
		legacyConfig.inspect('statusBar.showCommand') ||
		legacyConfig.inspect('statusBar.showStopCommand')
	);

	if (!hasLegacySettings) {
		return;
	}

	await context.globalState.update('legacyProjectRunnerSettingsWarningShown', true);
	vscode.window.showWarningMessage(
		'Universal Project Runner: old projectRunner settings are no longer used. Please migrate to universalProjectRunner.commands.'
	);
}
