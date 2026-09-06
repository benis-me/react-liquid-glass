/** Project calibrations; these are not measured native Apple parameters. */
export const SLIDER_CLICK_SPRING = { mass: 0.8, stiffness: 300, damping: 24 };
export const SEGMENTED_TRAVEL_SPRING = { mass: 1, stiffness: 260, damping: 28 };
export const SEGMENTED_PRESS_SPRING = { mass: 0.9, stiffness: 320, damping: 28 };
export const SEGMENTED_DRAG_CATCHUP_SPRING = { mass: 0.7, stiffness: 360, damping: 28 };
export const SEGMENTED_RELEASE_SPRING = { mass: 1, stiffness: 150, damping: 19 };
export const SEGMENTED_HEIGHT_RELEASE_SPRING = { mass: 0.8, stiffness: 260, damping: 23.6 };
export const SEGMENTED_IMPACT_RETENTION = 0.18;
export const SEGMENTED_TRAIL_BIAS = 0.35;
export const SEGMENTED_HOLD_IMPACT_SCRIPT = {
  stiffness: 360,
  damping: 24,
  impulse: -1.6,
} as const;

export const SIDE_BUTTON_SPRING = { stiffness: 1000, damping: 40, mass: 1.5 };
export const PLAY_BUTTON_SPRING = { stiffness: 500, damping: 32, mass: 1 };
export const BAR_DRAG_SPRING = { stiffness: 550, damping: 35, mass: 1 };
export const BUTTON_HOVER_SCALE = 1.045;


export const SURFACE_PRESS_SPRING = { mass: 1, stiffness: 420, damping: 28 };

export const ACTION_PRESS_SPRING = { mass: 1, stiffness: 280, damping: 22 };
export const ACTION_RELEASE_SPRING = { mass: 1, stiffness: 210, damping: 20 };
