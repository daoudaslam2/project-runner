import * as vscode from 'vscode';
import * as path from 'path';

const terminalByWorkspace = new Map<string, vscode.Terminal>();
const nativeDebugSessions = new Set<vscode.DebugSession>();
let runningCommandTerminal: vscode.Terminal | undefined;
let nativeActionRunning = false;

type RunnerConfig = {
	actionCommand: string;
	cwd: string;
	terminalName: string;
	actionRun: boolean;
	actionDebug: boolean;
	statusBarShowRun: boolean;
	statusBarShowDebug: boolean;
	statusBarShowCommand: boolean;
	statusBarShowStopCommand: boolean;
};

export function activate(context: vscode.ExtensionContext) {
	const runStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	runStatusBarItem.command = 'project-runner.runProject';
	runStatusBarItem.text = '$(play) Run Project';
	runStatusBarItem.tooltip = 'Run the current workspace project';

	const debugStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
	debugStatusBarItem.command = 'project-runner.debugProject';
	debugStatusBarItem.text = '$(debug-alt) Debug Project';
	debugStatusBarItem.tooltip = 'Start VS Code debugging';

	const commandStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
	commandStatusBarItem.command = 'project-runner.runCommand';
	commandStatusBarItem.text = '$(play)$(terminal) Run Command';
	commandStatusBarItem.tooltip = 'Run the configured terminal command';

	const stopCommandStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
	stopCommandStatusBarItem.command = 'project-runner.stopCommand';
	stopCommandStatusBarItem.text = '$(debug-stop) Stop Project';
	stopCommandStatusBarItem.tooltip = 'Stop the running Project Runner action';

	updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);

	const startRunning = createNativeDebugAction(
		'workbench.action.debug.run',
		runStatusBarItem,
		debugStatusBarItem,
		commandStatusBarItem,
		stopCommandStatusBarItem
	);

	const startDebugging = createNativeDebugAction(
		'workbench.action.debug.start',
		runStatusBarItem,
		debugStatusBarItem,
		commandStatusBarItem,
		stopCommandStatusBarItem
	);

	const runProject = vscode.commands.registerCommand('project-runner.runProject', startRunning);

	const debugProject = vscode.commands.registerCommand('project-runner.debugProject', startDebugging);

	const runCommand = vscode.commands.registerCommand('project-runner.runCommand', async () => {
		const workspaceFolder = await pickWorkspaceFolder();
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('Open a project folder before running a Project Runner command.');
			return;
		}

		const config = getRunnerConfig(workspaceFolder);
		if (!config.actionCommand.trim()) {
			vscode.window.showErrorMessage('Set projectRunner.action.command before running a command.');
			return;
		}

		const cwd = resolveCwd(workspaceFolder, config.cwd);
		const terminal = getOrCreateTerminal(workspaceFolder, config.terminalName, cwd);
		terminal.show();
		terminal.sendText(config.actionCommand);
		runningCommandTerminal = terminal;
		updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
	});

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
		updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
	});

	const configureCommand = vscode.commands.registerCommand('project-runner.configureCommand', async () => {
		const workspaceFolder = await pickWorkspaceFolder();
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('Open a project folder before configuring Project Runner.');
			return;
		}

		const config = getRunnerConfig(workspaceFolder);
		const command = await vscode.window.showInputBox({
			title: 'Project Runner Command',
			prompt: 'Command to run from the workspace folder',
			value: config.actionCommand,
			ignoreFocusOut: true
		});

		if (command === undefined) {
			return;
		}

		await vscode.workspace.getConfiguration('projectRunner', workspaceFolder.uri).update(
			'action.command',
			command,
			vscode.ConfigurationTarget.Workspace
		);

		updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
		vscode.window.showInformationMessage(`Project Runner command set to: ${command}`);
	});

	const terminalClose = vscode.window.onDidCloseTerminal((terminal) => {
		for (const [workspacePath, knownTerminal] of terminalByWorkspace.entries()) {
			if (knownTerminal === terminal) {
				terminalByWorkspace.delete(workspacePath);
			}
		}

		if (runningCommandTerminal === terminal) {
			runningCommandTerminal = undefined;
			updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
		}
	});

	const debugStart = vscode.debug.onDidStartDebugSession((session) => {
		nativeActionRunning = true;
		nativeDebugSessions.add(session);
		updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
	});

	const debugTerminate = vscode.debug.onDidTerminateDebugSession((session) => {
		if (nativeDebugSessions.delete(session)) {
			nativeActionRunning = nativeDebugSessions.size > 0;
			updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
		}
	});

	const configChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (
			event.affectsConfiguration('projectRunner.action.run') ||
			event.affectsConfiguration('projectRunner.action.debug') ||
			event.affectsConfiguration('projectRunner.action.command') ||
			event.affectsConfiguration('projectRunner.statusBar.showRun') ||
			event.affectsConfiguration('projectRunner.statusBar.showDebug') ||
			event.affectsConfiguration('projectRunner.statusBar.showCommand') ||
			event.affectsConfiguration('projectRunner.statusBar.showStopCommand')
		) {
			updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
		}
	});

	context.subscriptions.push(
		runProject,
		debugProject,
		runCommand,
		stopCommand,
		configureCommand,
		terminalClose,
		debugStart,
		debugTerminate,
		configChange,
		runStatusBarItem,
		debugStatusBarItem,
		commandStatusBarItem,
		stopCommandStatusBarItem
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
	const config = vscode.workspace.getConfiguration('projectRunner', workspaceFolder.uri);

	return {
		actionCommand: config.get('action.command', ''),
		cwd: config.get('cwd', ''),
		terminalName: config.get('terminalName', 'Project Runner'),
		actionRun: config.get('action.run', true),
		actionDebug: config.get('action.debug', true),
		statusBarShowRun: config.get('statusBar.showRun', true),
		statusBarShowDebug: config.get('statusBar.showDebug', false),
		statusBarShowCommand: config.get('statusBar.showCommand', false),
		statusBarShowStopCommand: config.get('statusBar.showStopCommand', true)
	};
}

function getGlobalRunnerConfig(): Pick<
	RunnerConfig,
	| 'actionRun'
	| 'actionDebug'
	| 'actionCommand'
	| 'statusBarShowRun'
	| 'statusBarShowDebug'
	| 'statusBarShowCommand'
	| 'statusBarShowStopCommand'
> {
	const config = vscode.workspace.getConfiguration('projectRunner');

	return {
		actionRun: config.get('action.run', true),
		actionDebug: config.get('action.debug', true),
		actionCommand: config.get('action.command', ''),
		statusBarShowRun: config.get('statusBar.showRun', true),
		statusBarShowDebug: config.get('statusBar.showDebug', false),
		statusBarShowCommand: config.get('statusBar.showCommand', false),
		statusBarShowStopCommand: config.get('statusBar.showStopCommand', true)
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
	cwd: string
): vscode.Terminal {
	const existingTerminal = terminalByWorkspace.get(workspaceFolder.uri.fsPath);
	if (existingTerminal) {
		return existingTerminal;
	}

	const terminal = vscode.window.createTerminal({
		name: terminalName,
		cwd
	});

	terminalByWorkspace.set(workspaceFolder.uri.fsPath, terminal);
	return terminal;
}

function createNativeDebugAction(
	command: string,
	runStatusBarItem: vscode.StatusBarItem,
	debugStatusBarItem: vscode.StatusBarItem,
	commandStatusBarItem: vscode.StatusBarItem,
	stopCommandStatusBarItem: vscode.StatusBarItem
): () => Promise<void> {
	return async () => {
		nativeActionRunning = true;
		updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);

		try {
			await vscode.commands.executeCommand(command);
		} catch (error) {
			nativeActionRunning = false;
			updateActionVisibility(runStatusBarItem, debugStatusBarItem, commandStatusBarItem, stopCommandStatusBarItem);
			throw error;
		}
	};
}

function updateActionVisibility(
	runStatusBarItem: vscode.StatusBarItem,
	debugStatusBarItem: vscode.StatusBarItem,
	commandStatusBarItem: vscode.StatusBarItem,
	stopCommandStatusBarItem: vscode.StatusBarItem
): void {
	const config = getGlobalRunnerConfig();
	const hasCommandAction = Boolean(config.actionCommand.trim());
	const commandRunning = Boolean(runningCommandTerminal || nativeActionRunning || nativeDebugSessions.size);

	void vscode.commands.executeCommand('setContext', 'projectRunner.action.run', config.actionRun);
	void vscode.commands.executeCommand('setContext', 'projectRunner.action.debug', config.actionDebug);
	void vscode.commands.executeCommand('setContext', 'projectRunner.hasCommandAction', hasCommandAction);
	void vscode.commands.executeCommand('setContext', 'projectRunner.commandRunning', commandRunning);

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

	if (config.statusBarShowCommand && hasCommandAction && !commandRunning) {
		commandStatusBarItem.show();
	} else {
		commandStatusBarItem.hide();
	}

	if (config.statusBarShowStopCommand && commandRunning) {
		stopCommandStatusBarItem.show();
	} else {
		stopCommandStatusBarItem.hide();
	}
}
