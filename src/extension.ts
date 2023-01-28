// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ButtplugClient, ButtplugClientDevice, ButtplugNodeWebsocketClientConnector } from 'buttplug';

const config = vscode.workspace.getConfiguration("prohe");
const VIBRATION_TIMEOUT = config.get("typingwindow", 5000);
const VIBRATION_MAX = config.get("vibrationMax", 0.5);
const VIBRATION_STEPS = config.get("vibrationStages", 10);
const VIBRATION_STEP_LENGTH = config.get("vibrationStageLength", 10000);
const VIBRATION_STEP_SIZE = VIBRATION_MAX / VIBRATION_STEPS;

const MESSAGE_TIMEOUT = 5000;
const CONNECTION_TIMEOUT = 5000;

interface DeviceStatus {
	level: number
	timeout: NodeJS.Timeout,
	lastThresholdChange: Date,
}
var client: ButtplugClient | null = null;
var devices: Array<ButtplugClientDevice> = [];
var deviceStatus: Map<ButtplugClientDevice, DeviceStatus> = new Map();

function updateDeviceList() {
	if (client === null) {
		devices = [];
		vscode.window.setStatusBarMessage('PROHE: No server connected', MESSAGE_TIMEOUT);
		return;
	}

	client.devices.forEach((device, idx) => {
		if (device.vibrateAttributes.length > 0) {
			console.debug(`Device ${device.name} connected (index ${idx})`);
			devices.push(device);
		}
	});
}

function updateDeviceVibration(device: ButtplugClientDevice, touched: boolean) {
	let status = deviceStatus.get(device);
	if (status !== undefined) {
		// Update existing
		clearTimeout(status.timeout);
		const oldLevel = status.level;
		if (touched) {
			if (status.level < VIBRATION_MAX && new Date().valueOf() - status.lastThresholdChange.valueOf() > VIBRATION_STEP_LENGTH) {
				status.level = Math.min(status.level + VIBRATION_STEP_SIZE, VIBRATION_MAX);
				status.lastThresholdChange = new Date();
			}
		} else {
			status.level -= VIBRATION_STEP_SIZE;
			if (status.level <= Number.EPSILON) {
				stopDevice(device);
				return;
			}
			status.lastThresholdChange = new Date();
		}

		status.timeout = setTimeout(() => updateDeviceVibration(device, false), VIBRATION_TIMEOUT);
		if (status.level !== oldLevel) {
			console.debug(`Setting ${device.name} to ${status.level}`);
			device.vibrate(status.level);
		}

		return;
	}

	if (!touched) {
		// No existing status and wasn't touched - can just ignore
		return;
	}

	// Create new
	console.debug(`Starting vibrating ${device.name} at ${VIBRATION_STEP_SIZE}`);
	deviceStatus.set(
		device, {
		level: VIBRATION_STEP_SIZE,
		timeout: setTimeout(
			() => updateDeviceVibration(device, false),
			VIBRATION_TIMEOUT
		),
		lastThresholdChange: new Date()
	});
	device.vibrate(VIBRATION_STEP_SIZE);
}

function stopDevice(device: ButtplugClientDevice) {
	deviceStatus.delete(device);
	device.stop().then(() => console.debug('Stopping ' + device.name));
}

function showError(context: string, err: any) {
	vscode.window.showErrorMessage(
		"Error during " + context + (err === null ? "" : `: ${err}`)
	);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.debug('PROHE activated');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const connectCommand = vscode.commands.registerCommand('prohe.connect', () => {
		vscode.window.setStatusBarMessage('PROHE: Attempting server connection...', MESSAGE_TIMEOUT);
		let potential = new ButtplugClient("PROHE");
		const connector = new ButtplugNodeWebsocketClientConnector("ws://localhost:12345");
		potential.on("error", (err) => showError("server connection", err));
		const connectionTimer = setTimeout(() => showError(
			"server connection",
			"connection timed out. Is Intiface Central running, and the server started?"
		), CONNECTION_TIMEOUT);
		try {
			potential.connect(connector)
				.then(() => {
					clearTimeout(connectionTimer);
					client = potential;
					vscode.window.setStatusBarMessage('PROHE: Connected', MESSAGE_TIMEOUT);
				})
				.then(updateDeviceList)
				.then(() => context.subscriptions.push(textDocChange))
				.catch((err) => {
					clearTimeout(connectionTimer);
					showError("server connection", err);
				});
		} catch (err) {
			clearTimeout(connectionTimer);
			showError("server connection", err);
		}
	});

	const updateDeviceListCommand = vscode.commands.registerCommand('prohe.updatedevicelist', updateDeviceList);

	const disconnectCommand = vscode.commands.registerCommand('prohe.disconnect', () => {
		if (client === null) {
			vscode.window.setStatusBarMessage('PROHE: No server connected', MESSAGE_TIMEOUT);
			return;
		}
		client.disconnect().then(
			() => {
				vscode.window.setStatusBarMessage('PROHE: Server disconnected', MESSAGE_TIMEOUT);
				const pos = context.subscriptions.indexOf(textDocChange);
				if (pos > -1) {
					context.subscriptions.splice(pos, 1);
				}
				client = null;
				devices = [];
			}
		).catch((err) => showError("server disconnection", err));
	});

	const textDocChange = vscode.workspace.onDidChangeTextDocument((e) => {
		if (e.document.uri.scheme === "output") {
			return;
		}

		devices.forEach((device) => updateDeviceVibration(device, true));
	});

	context.subscriptions.push(connectCommand, updateDeviceListCommand, disconnectCommand);
}

// This method is called when the extension is deactivated
export function deactivate() {
	if (client === null) {
		return;
	}
	client.stopAllDevices()
		.then(() => client!.disconnect())
		.catch((err) => showError("plugin deactivation", err));
}
