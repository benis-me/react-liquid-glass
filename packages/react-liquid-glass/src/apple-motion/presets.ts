/** Project calibrations; these are not measured native Apple parameters. */
export const SLIDER_CLICK_SPRING = { mass: 0.8, stiffness: 300, damping: 24 };
/** A dragged Switch thumb carries its release velocity into this spring; taps keep their tween. */
export const SWITCH_RELEASE_SPRING = { mass: 1, stiffness: 240, damping: 23 };
/** Seconds of travel projected along the release velocity when choosing a flicked Switch's side. */
export const SWITCH_FLICK_PROJECTION = 0.08;
export const SEGMENTED_TRAVEL_SPRING = { mass: 1, stiffness: 260, damping: 28 };
export const SEGMENTED_PRESS_SPRING = { mass: 0.9, stiffness: 320, damping: 28 };
export const SEGMENTED_DRAG_CATCHUP_SPRING = { mass: 0.7, stiffness: 360, damping: 28 };
export const SEGMENTED_RELEASE_SPRING = { mass: 1, stiffness: 150, damping: 19 };
export const SEGMENTED_HEIGHT_RELEASE_SPRING = { mass: 0.8, stiffness: 260, damping: 23.6 };
export const SEGMENTED_IMPACT_RETENTION = 0.18;
export const SEGMENTED_TRAIL_BIAS = 0.35;
/** Velocity stretch of the Tabs lens: tight tracking while moving, a lighter recoil once it lands. */
export const SEGMENTED_DEFORMATION = { perSpeed: 0.00024, stiffness: 760, damping: 50, landedDamping: 30 };
/**
 * How far a pressed Tabs lens grows past its tab on every side, as a fraction of the tab's height:
 * 9px on a native-sized 53px tab. Scaled with the tab, the lens overflows any bar by the same
 * share of its height as iOS 27's, so the bar's edge meets its rim band where native's does.
 */
export const SEGMENTED_LIFT_OUTSET = 0.17;
/** Landing: once the lens is this close to its tab, it shrinks and dissolves over the solid thumb. */
export const SEGMENTED_HANDOFF = { arrivalPixels: 4, dissolve: { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const } };
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

/** The Spotlight lens follows the pointer as a lightly damped mass, not an exponential filter. */
export const SPOTLIGHT_FOLLOW_SPRING = { mass: 1, stiffness: 200, damping: 24 };
/** Ambient drift speed in CSS pixels per second. */
export const SPOTLIGHT_DRIFT_SPEED = 90;
/** Ambient drift eases to rest after this long without page activity, and resumes on activity. */
export const SPOTLIGHT_IDLE_MS = 30_000;

export const ACTION_PRESS_SPRING = { mass: 1, stiffness: 280, damping: 22 };
export const ACTION_RELEASE_SPRING = { mass: 1, stiffness: 210, damping: 20 };
