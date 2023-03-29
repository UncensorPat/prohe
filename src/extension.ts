// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ButtplugClient, ButtplugClientDevice, ButtplugNodeWebsocketClientConnector } from 'buttplug';

const DEFAULT_VIBRATION_TIMEOUT = 5000
const DEFAULT_VIBRATION_MAX = 0.5
const DEFAULT_VIBRATION_STEPS = 10
const DEFUALT_VIBRATION_STEP_LENGTH = 10000

const MESSAGE_TIMEOUT = 5000;
const CONNECTION_TIMEOUT = 5000;

interface DeviceStatus {
	level: number
	timeout: NodeJS.Timeout,
	lastThresholdChange: Date,
}
interface Configuration {
	VIBRATION_TIMEOUT: number,
	VIBRATION_MAX: number,
	VIBRATION_STEPS: number,
	VIBRATION_STEP_LENGTH: number
	VIBRATION_STEP_SIZE: number
}

var client: ButtplugClient | null = null;
var devices: Array<ButtplugClientDevice> = [];
var deviceStatus: Map<ButtplugClientDevice, DeviceStatus> = new Map();

function fetchConfig(): Configuration {
	const settings = vscode.workspace.getConfiguration("prohe");
	const config_obj: Configuration = {
		VIBRATION_TIMEOUT: settings.get('typingWindow', DEFAULT_VIBRATION_TIMEOUT),
		VIBRATION_MAX: settings.get('vibrationMax', DEFAULT_VIBRATION_MAX),
		VIBRATION_STEPS: settings.get('vibrationStages', DEFAULT_VIBRATION_STEPS),
		VIBRATION_STEP_LENGTH: settings.get('vibrationStageLength', DEFUALT_VIBRATION_STEP_LENGTH),
		get VIBRATION_STEP_SIZE() {
			return this.VIBRATION_MAX / this.VIBRATION_STEPS;
		},
	};
	return config_obj;
}

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
	let config = fetchConfig()
	let status = deviceStatus.get(device);
	if (status !== undefined) {
		// Update existing
		clearTimeout(status.timeout);
		const oldLevel = status.level;
		if (touched) {
			if (status.level < config.VIBRATION_MAX && new Date().valueOf() - status.lastThresholdChange.valueOf() > config.VIBRATION_STEP_LENGTH) {
				status.level = Math.min(status.level + config.VIBRATION_STEP_SIZE, config.VIBRATION_MAX);
				status.lastThresholdChange = new Date();
			}
		} else {
			status.level -= config.VIBRATION_STEP_SIZE;
			if (status.level <= Number.EPSILON) {
				stopDevice(device);
				return;
			}
			status.lastThresholdChange = new Date();
		}

		if (status.level > config.VIBRATION_MAX) {
			status.level = config.VIBRATION_MAX
		};

		status.timeout = setTimeout(() => updateDeviceVibration(device, false), config.VIBRATION_TIMEOUT);
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
	console.debug(`Starting vibrating ${device.name} at ${config.VIBRATION_STEP_SIZE}`);
	deviceStatus.set(
		device, {
		level: config.VIBRATION_STEP_SIZE,
		timeout: setTimeout(
			() => updateDeviceVibration(device, false),
			config.VIBRATION_TIMEOUT
		),
		lastThresholdChange: new Date()
	});
	device.vibrate(config.VIBRATION_STEP_SIZE);
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
