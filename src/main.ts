import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ScriptX from 'vue-scriptx'
import Ads from 'vue-google-adsense'
import { installReforgerIndexMapping } from './input/reforgerIndex'
import { installIgnoredGamepadRuntimeFilter } from './input/ignoredGamepadFilter'
import { mountMergedDevicePanel } from './input/mergedDevices'

// Keep the browser's physical Gamepad API index separate from the joystickN number written to
// Reforger configs. Install this before App mounts so all existing detection logic sees the
// user-selected, persistent Reforger index while WebHID can still read the raw browser index.
installReforgerIndexMapping()

// Persistently ignored devices remain visible in the merged Connected Devices panel through the
// raw Gamepad API, but they must not participate in binding detection or either Live Input Monitor.
installIgnoredGamepadRuntimeFilter()

const app = createApp(App)

app.use(ScriptX)
app.use(Ads.Adsense, {})

app.mount('#app')
mountMergedDevicePanel()
