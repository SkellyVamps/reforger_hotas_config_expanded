export type FilterPreset =
  | 'pressed'
  | 'previous'
  | 'next'
  | 'click'
  | 'hold'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'forward'
  | 'back'
  | 'toggle'
  | 'select';

export type HardwareType =
  | 'button'
  | 'trigger'
  | 'stick'
  | 'throttle'
  | 'pedals'
  | 'hat'
  | 'switch';

export type ImportanceLevel = 'critical' | 'important' | 'optional';

export interface Action {
  name: string;
  /** Action name written to the .conf when it differs from the unique UI name.
   *  Lets two direction-split entries (e.g. PFC_PitchUp / PFC_PitchDown)
   *  merge into a single Action block with multiple sources. */
  confName?: string;
  /** Emitted as an InputFilterValue Multiplier on this entry's sources —
   *  used for the negative direction of full-range analog actions. */
  multiplier?: number;
  /** Strip the trailing +/- from detected axis bindings so the whole axis
   *  feeds the action (absolute-axis actions like PFC_ThrottleAxis). */
  rawAxis?: boolean;
  filterPreset: FilterPreset;
  hint: string;
  hardware: HardwareType;
  importance: ImportanceLevel;
  bindings: string[];
}

export interface ConnectedGamepad {
  id: string;
  index: number;
}

export interface GamepadState {
  buttons: { pressed: boolean }[];
  axes: number[];
}

export interface AppState {
  actions: Action[];
  currentActionIndex: number;
  furthestActionIndex: number;
  configuring: boolean;
  connectedGamepads: Record<number, ConnectedGamepad>;
  previousGamepadState: Record<number, GamepadState>;
  baselineGamepadState: Record<number, GamepadState>;
  filter: 'all' | 'configured' | 'unconfigured';
  inputCooldown: boolean;
  pendingInput: string | null;
}
