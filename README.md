# PROHE - Productivity-Reinforcement-Oriented Haptics Extension

Are you looking for a way to inspire productivity within your code development? Traditional KPIs not providing sufficient motivation to get what you need done? Maybe PROHE is the motivational muse you need.

PROHE is a Visual Studio Code extension that enables developers to enhance their coding experience with haptics from supported devices.

The extension leverages the Intiface platform to connect to your device and provide real-time productivity reinforcement as you type into your VSCode editor.

## Features

- Connects to your supported haptics-enabled devices via the Intiface platform.
- Haptics intensity builds up with consistent typing, reaching a maximum threshold.
- Haptics intensity decreases over time in response to a lack of typing.

## Requirements

- Visual Studio Code (VSCode)
- Intiface Central software installed and server running

## Installation

1. Open VS Code
2. Go to the Extensions view (`⇧⌘X` on macOS or `Ctrl+Shift+X` on Windows/Linux)
3. Search for `PROHE` and click the Install button
4. Once the installation is complete, click the Reload button

## Usage

1. Connect your supported device to your computer via the Intiface Central software
2. Open Visual Studio Code
3. Run the `PROHE: Connect` command from the Command Palette (`⇧⌘P` on macOS or `Ctrl+Shift+P` on Windows/Linux)
4. Start typing in your VSCode editor to experience the vibration feedback

## Configuration

The following options are available for configuration:

- `prohe.serverAddress`: The Intiface Central server address to connect to (typically of the form `ws://SERVER:PORT`)
- `prohe.typingWindow`: Length of the gap in typing (in milliseconds) before vibration decreases by a stage
- `prohe.vibrationMax`: The maximum vibration intensity that can be achieved
- `prohe.vibrationStages`: The number of stages the vibration increases through
  - More stages means a more granular vibration change per stage
  - A higher number will mean more stages to get through to get to maximum vibration
- `prohe.vibrationStageLength`: Duration (in milliseconds) of each stage of vibration
  - Longer stage length will mean a longer ramp up time to get to maximum vibration

## Support

For any issues or questions, please visit the [PROHE GitHub repository](https://github.com/UncensorPat/prohe).

## The Future Of PROHE

Note that all of the below listed ideas are merely concepts - there are no guarantees or roadmap.

- "Panic Button" keybind to disconnect
- Event-triggered interactions
  - On save
  - When running tests
- Automatically refresh device list
- Connect on load (toggleable)
