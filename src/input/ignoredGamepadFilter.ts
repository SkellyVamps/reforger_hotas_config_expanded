// Hide persistently ignored Gamepad API devices from the application's runtime input stream.
// reforgerIndex maps ignored devices to a private negative index; the merged device panel reads
// the raw Gamepad API separately, so ignored hardware can remain visible there for Restore while
// disappearing from binding detection and both Live Input Monitor views.
export function installIgnoredGamepadRuntimeFilter(): void {
  const getMappedGamepads = navigator.getGamepads.bind(navigator)

  const filteredGetGamepads = () => {
    const gamepads = Array.from(getMappedGamepads())
    return gamepads.map(gamepad => {
      if (gamepad && gamepad.index < 0) return null
      return gamepad
    }) as ReturnType<Navigator['getGamepads']>
  }

  try {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: filteredGetGamepads
    })
    return
  } catch {
    // Fall back to Navigator's prototype in browsers that reject an own-property override.
  }

  try {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'getGamepads', {
      configurable: true,
      value: filteredGetGamepads
    })
  } catch (error) {
    console.warn('Unable to hide ignored Gamepad API devices from runtime input:', error)
  }
}
