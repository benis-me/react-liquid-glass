/** Project calibrations; these are not measured native Apple parameters. */
export const SLIDER_CLICK_SPRING = { mass: 0.8, stiffness: 300, damping: 24 };
/**
 * A thumb's travel: a tapped Switch, a flicked one carrying its release velocity, and a Slider
 * returning into its track. One spring, so every thumb moves with the same weight.
 */
export const SWITCH_RELEASE_SPRING = { mass: 1, stiffness: 240, damping: 23 };
/** Seconds of travel projected along the release velocity when choosing a flicked Switch's side. */
export const SWITCH_FLICK_PROJECTION = 0.08;
export const SEGMENTED_TRAVEL_SPRING = { mass: 1, stiffness: 260, damping: 28 };
/** Quick, nearly critical: a tab bar's press, a lifted lens going still, a thumb's white filling back in. */
export const SEGMENTED_PRESS_SPRING = { mass: 0.9, stiffness: 320, damping: 28 };
export const SEGMENTED_DRAG_CATCHUP_SPRING = { mass: 0.7, stiffness: 360, damping: 28 };
/**
 * A released thumb's white fills back in, critically damped and quick, nine tenths in about 0.1s,
 * so what the lens showed of the track never lingers as a grey ghost while the lens sinks.
 */
export const THUMB_FILL_SPRING = { mass: 1, stiffness: 1600, damping: 80 };
/** A lifted lens settles back: a released tab's lens as it lands, and a released thumb. */
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
/** A lifted lens rises with a slight overshoot, about a tenth, before it settles: a pressed tab's and a held thumb's. */
export const LIFT_SPRING = { mass: 1, stiffness: 340, damping: 22 };
/**
 * A dragged tab's lens past the first or last tab follows with resistance, as a Switch thumb does
 * past its end: by at most `distance` pixels, as far as a Switch thumb goes, reached once the finger
 * is `dampening` times that far past the tab. It carries the bar along by `carry` of its own
 * distance, and both spring back on release.
 */
export const SEGMENTED_OVERDRAG = { distance: 11, dampening: 10, carry: 0.3 };
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


/** An alert settles into place on a light spring. */
export const ALERT_SPRING = { mass: 1, stiffness: 360, damping: 30 };
/** An accordion section opens and closes on a nearly critical spring. */
export const ACCORDION_SPRING = { mass: 1, stiffness: 320, damping: 32 };
/** Pressed glass grows by this much, as Apple's interactive glass does. */
export const GLASS_PRESS_SCALE = 1.025;
/**
 * Pressed glass grows to GLASS_PRESS_SCALE, and returns, on this spring: a Button, a popup's
 * trigger, the Morph Menu's trigger and a Glass Group shape alike.
 */
export const SURFACE_PRESS_SPRING = { mass: 1, stiffness: 420, damping: 28 };
/** A press's glow spreads from under the finger through the whole glass, critically damped, in about 0.3s. */
export const PRESS_GLOW_SPRING = { mass: 1, stiffness: 170, damping: 26 };

/** The Spotlight lens grows under the pointer and shrinks back without overshoot, nine tenths of the way in about 0.16s. */
export const SPOTLIGHT_RESIZE_SPRING = { mass: 1, stiffness: 590, damping: 48 };
/** The Spotlight lens follows the pointer as a lightly damped mass, not an exponential filter. */
export const SPOTLIGHT_FOLLOW_SPRING = { mass: 1, stiffness: 200, damping: 24 };
/** Ambient drift speed in CSS pixels per second. */
export const SPOTLIGHT_DRIFT_SPEED = 90;
/** Ambient drift eases to rest after this long without page activity, and resumes on activity. */
export const SPOTLIGHT_IDLE_MS = 30_000;

