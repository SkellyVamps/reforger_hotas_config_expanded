# Arma Reforger HOTAS Configurator Expanded

A browser-based configurator for setting up HOTAS (Hands On Throttle And Stick) controls in Arma Reforger, including expanded WebHID button support and fixed-wing aircraft actions.

---

## 🚀 **[Use the Online Tool Here →](https://skellyvamps.github.io/reforger_hotas_config_expanded/)**

The configurator can run directly in your browser at [https://skellyvamps.github.io/reforger_hotas_config_expanded/](https://skellyvamps.github.io/reforger_hotas_config_expanded/).

No installation is needed. Connect your joystick, grant WebHID access when needed, and start configuring.

---

## Features

- **Browser-Based**: No installation required - runs entirely in your web browser
- **Expanded WebHID Support**: Supports joystick buttons beyond the Gamepad API's practical 32-button range
- **Hybrid Input Mapping**: Keeps Gamepad API numbering for standard buttons/axes while WebHID extends the same device with buttons 32+
- **Interactive Configuration**: Walk through each action and assign buttons/axes
- **Fixed-Wing Aircraft Support**: PFC/flight-core actions for aircraft such as SU-25, SU-33, C-130 and others
- **Absolute Throttle Axis**: Captures the full throttle axis for aircraft that expect a full-range input
- **HAT Switch Support**: Special detection mode for HAT switches and POV controls
- **Visual Feedback**: Real-time display of configured actions with progress tracking
- **Config Generation**: Generates Arma Reforger-compatible `.conf` files
- **Smart Defaults**: Automatically names config files based on your joystick
- **Navigation**: Arrow keys and clickable actions for easy configuration editing

## Quick Start

1. Visit **[https://skellyvamps.github.io/reforger_hotas_config_expanded/](https://skellyvamps.github.io/reforger_hotas_config_expanded/)** in Chrome or Edge
2. Connect your HOTAS/joystick
3. Click **Connect HOTAS / Joystick with WebHID** if you need expanded button support
4. Choose the correct Reforger joystick index (`joystick0` through `joystick3`)
5. Click **Start Configuring**
6. Follow the prompts to assign each action
7. Press **SPACE** to confirm each input
8. Download your config when complete

## Installation

### Save Location

After downloading your config file, save it to:

```
%USERPROFILE%\Documents\My Games\ArmaReforger\profile\.save\settings\customInputConfigs
```

Or on Linux:

```
~/.local/share/bohemia interactive/arma reforger/profile/.save/settings/customInputConfigs
```

## Usage

### Configuring Actions

1. **Press or move** a button/axis on your joystick
2. **Press SPACE** to confirm the detected input
3. Use **↑/↓ arrows** to navigate between actions
4. Click any action in the list to jump to it
5. Use **Skip** to skip an action
6. Use **Clear Binding** to remove a binding

### WebHID and Extended Buttons

The configurator uses a hybrid input system when WebHID is connected:

- The browser Gamepad API remains the source for the standard button and axis numbering used by Arma Reforger.
- WebHID extends that same joystick with buttons beyond the normal Gamepad API range.
- A 44-button joystick can therefore generate inputs through `button43` while preserving the mappings of buttons `0` through `31`.

WebHID requires a Chromium-based browser such as Chrome or Edge and a secure HTTPS context.

### Fixed-Wing Aircraft Actions

Fixed-wing aircraft support is enabled by default and can be toggled from the Actions section.

Supported PFC/flight-core actions include:

- Pitch, roll and yaw
- Absolute throttle axis
- Throttle up/down button fallbacks
- Aircraft weapon cycling
- Landing gear
- Flaps
- Airbrake
- Wheel and parking brakes
- Engine start/stop
- Pitch trim and trim reset
- Flight-control-system override
- Reverse thrust
- Taxi and landing lights

Aircraft pitch, roll and yaw are configured as directional entries in the UI but are merged into single full-range analog actions in the generated config. Negative directions receive the appropriate input multiplier. The absolute throttle action strips the detected `+`/`-` half-axis suffix and emits the complete axis.

### HAT Mode

Enable **HAT Mode** for difficult HAT switches that behave unexpectedly. This uses simplified detection for discrete axis inputs.

### Resume Feature

If you navigate backward, a **Resume** button appears to jump back to where you left off.

## Configuration Actions

The configurator supports actions including:

- **Fixed-wing aircraft**: PFC pitch/roll/yaw, throttle, gear, flaps, airbrake, brakes, engines, trim, FCS, reverse thrust and lights
- **Character**: Fire, weapon switching, optics
- **Helicopter**: Collective, cyclic, anti-torque, brakes, lights
- **Turret**: Fire, aiming, rotation, reload
- **Voice**: VON toggle and channel
- **Utility**: Get out, map, perform action
- **WCS Armament** (optional): weapon cycling, fire modes, missile lock activate/confirm, flares/chaff/smoke

## Technical Details

- Uses a hybrid **Gamepad API + WebHID** input system
- Generates configs compatible with Arma Reforger's `customInputConfig.conf` format
- Supports Reforger joystick indices `joystick0` through `joystick3`
- Includes proper GUID generation for InputSource elements
- Implements FilterPreset handling matching Arma Reforger's input manager
- Supports grouped config actions using `confName`, per-source multipliers, and raw full-axis output

## Browser Compatibility

- ✅ Chrome/Edge (recommended; required for WebHID extended-button support)
- ⚠️ Firefox (Gamepad API fallback only; no WebHID)
- ⚠️ Safari (Gamepad API fallback only; no WebHID)

## Monetization

This tool includes Google AdSense integration. See `ADSENSE_SETUP.md` for setup instructions.

## Contributing

Contributions are welcome. Feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Share feedback

### Running Locally for Development

If you want to contribute or run the configurator locally:

1. Clone this repository
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Build for production: `npm run build`

The configurator is built with Vue 3 + TypeScript + Vite.

## License

MIT License - feel free to use and modify for your own projects.

## Credits

Based on the original Arma Reforger HOTAS Configurator by StormPale / jscrobinson.

Fixed-wing aircraft support was adapted from the changes in `codingpandaren/reforger_hotas_config_aircraft`.

## Links

- **[HOTAS Configurator Expanded](https://skellyvamps.github.io/reforger_hotas_config_expanded/)**
- [Arma Reforger Input Manager Wiki](https://community.bistudio.com/wiki/Arma_Reforger:Input_Manager)
- [Arma Reforger Official Site](https://reforger.armaplatform.com/)

## Support

If you find this tool helpful, consider sharing it with your Arma community.
