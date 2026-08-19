import * as vscode from 'vscode';
import * as path from 'path';

const terminalByWorkspace = new Map<string, vscode.Terminal>();

type RunnerConfig = {
	buttonAction: 'run' | 'debug';
	command: string;
	cwd: string;
	terminalName: string;
	showStatusBarButton: boolean;
};

export function activate(context: vscode.ExtensionContext) {
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'project-runner.runProject';
	updateStatusBar(statusBarItem);

	const runProject = vscode.commands.registerCommand('project-runner.runProject', async () => {
		const globalConfig = getGlobalRunnerConfig();
		if (globalConfig.buttonAction === 'debug') {
			await vscode.commands.executeCommand('workbench.action.debug.start');
			return;
		}

		const workspaceFolder = await pickWorkspaceFolder();
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('Open a project folder before running Project Runner.');
			return;
		}

		const config = getRunnerConfig(workspaceFolder);
		if (!config.command.trim()) {
			vscode.window.showErrorMessage('Set projectRunner.command before running the project.');
			return;
		}

		const cwd = resolveCwd(workspaceFolder, config.cwd);
		const terminal = getOrCreateTerminal(workspaceFolder, config.terminalName, cwd);
		terminal.show();
		terminal.sendText(config.command);
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
			value: config.command,
			ignoreFocusOut: true
		});

		if (command === undefined) {
			return;
		}

		await vscode.workspace.getConfiguration('projectRunner', workspaceFolder.uri).update(
			'command',
			command,
			vscode.ConfigurationTarget.Workspace
		);

		vscode.window.showInformationMessage(`Project Runner command set to: ${command}`);
	});

	const terminalClose = vscode.window.onDidCloseTerminal((terminal) => {
		for (const [workspacePath, knownTerminal] of terminalByWorkspace.entries()) {
			if (knownTerminal === terminal) {
				terminalByWorkspace.delete(workspacePath);
			}
		}
	});

	const configChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (
			event.affectsConfiguration('projectRunner.showStatusBarButton') ||
			event.affectsConfiguration('projectRunner.buttonAction')
		) {
			updateStatusBar(statusBarItem);
		}
	});

	context.subscriptions.push(runProject, configureCommand, terminalClose, configChange, statusBarItem);
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
		buttonAction: config.get<'run' | 'debug'>('buttonAction', 'run'),
		command: config.get('command', 'npm run dev'),
		cwd: config.get('cwd', ''),
		terminalName: config.get('terminalName', 'Project Runner'),
		showStatusBarButton: config.get('showStatusBarButton', true)
	};
}

function getGlobalRunnerConfig(): Pick<RunnerConfig, 'buttonAction' | 'showStatusBarButton'> {
	const config = vscode.workspace.getConfiguration('projectRunner');

	return {
		buttonAction: config.get<'run' | 'debug'>('buttonAction', 'run'),
		showStatusBarButton: config.get('showStatusBarButton', true)
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

function updateStatusBar(statusBarItem: vscode.StatusBarItem): void {
	const config = getGlobalRunnerConfig();

	if (config.buttonAction === 'debug') {
		statusBarItem.text = '$(debug-start) Debug Project';
		statusBarItem.tooltip = 'Start VS Code debugging';
	} else {
		statusBarItem.text = '$(play) Run Project';
		statusBarItem.tooltip = 'Run the current workspace project';
	}

	if (config.showStatusBarButton) {
		statusBarItem.show();
	} else {
		statusBarItem.hide();
	}
}
