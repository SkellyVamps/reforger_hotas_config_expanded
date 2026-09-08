import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ScriptX from 'vue-scriptx'
import Ads from 'vue-google-adsense'
import { installReforgerIndexMapping } from './input/reforgerIndex'
import { mountMergedDevicePanel } from './input/mergedDevices'

// Keep the browser's physical Gamepad API index separate from the joystickN number written to
// Reforger configs. Install this before App mounts so all existing detection logic sees the
// user-selected, persistent Reforger index while WebHID can still read the raw browser index.
installReforgerIndexMapping()

const app = createApp(App)

app.use(ScriptX)
app.use(Ads.Adsense, {})

app.mount('#app')
mountMergedDevicePanel()
