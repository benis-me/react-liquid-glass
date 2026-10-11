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
/**
 * Velocity stretch of the Tabs lens, a soft body on a spring. Moving at v px/s, averaged over
 * `smoothing` seconds, it stretches along its motion by `max · tanh(v / speed)`: a slow drag barely
 * deforms it, a moderate one by about a tenth, a quick one by up to a fifth. The spring builds the stretch
 * with `damping` and relaxes it with the lighter `settleDamping`, so when a drag stops or the lens
 * lands it overshoots into a brief squash and rebounds, while a steady drag stays calm.
 */
export const SEGMENTED_DEFORMATION = { max: 0.2, speed: 480, smoothing: 0.02, stiffness: 576, damping: 18, settleDamping: 12 };
/** The same soft body for held Switch and Slider thumbs, which travel shorter and slower. */
export const THUMB_DEFORMATION = { max: 0.22, speed: 380, smoothing: 0.02, stiffness: 576, damping: 18, settleDamping: 12 };
/** A pressed tab's lens lifts with a slight overshoot, about a tenth, before it settles. */
export const SEGMENTED_LIFT_SPRING = { mass: 1, stiffness: 340, damping: 22 };
/**
 * A dragged tab's lens pulled past the first or last tab stays on it and is pulled toward the
 * finger against rising resistance, as a scroll view's edge is: for a finger `d` past the tab its
 * far end reaches `limit·(1 − 1/(1 + resistance·d/limit))`, never more than `reach` of the lens's
 * height. Its near end follows by `trail` of that, so the lens stretches toward the finger, and it
 * thins across by the square root of its stretch. Released, it lands once its far end has sprung
 * back to within `settle` pixels.
 */
export const SEGMENTED_OVERDRAG = { reach: 0.6, resistance: 0.55, trail: 0.25, thinning: 0.5, settle: 1.5 };
/** Released, a pulled lens springs back, overshooting by about a fifth into a brief squash. */
export const SEGMENTED_OVERDRAG_SPRING = { mass: 1, stiffness: 400, damping: 17 };
/**
 * How far a pressed Tabs lens grows past its tab on every side, as a fraction of the tab's height:
 * 9px on a native-sized 53px tab. Scaled with the tab, the lens overflows any bar by the same
 * share of its height as iOS 27's, so the bar's edge meets its rim band where native's does.
 */
export const SEGMENTED_LIFT_OUTSET = 0.17;
/**
 * Landing: once the lens is this close to its tab it sinks back, and once its lift has fallen to
 * `dissolveLift` it dissolves over the solid thumb, so what it magnifies is near its own size by then.
 */
export const SEGMENTED_HANDOFF = { arrivalPixels: 4, dissolveLift: 0.4, dissolve: { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const } };
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
