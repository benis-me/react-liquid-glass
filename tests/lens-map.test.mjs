import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_LENS_PARAMS,
  PLAYGROUND_DEFAULTS,
  axisScaleMatrix,
  motionValue,
} from "../dist/library/index.js";

const filterSource = readFileSync(
  process.env.FILTER_SOURCE ?? new URL("../src/lib/glass.tsx", import.meta.url),
  "utf8",
);
const displacementSource = readFileSync(new URL("../src/lib/displacement-map.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const controlGallerySource = readFileSync(new URL("../src/demos/ControlGallery.tsx", import.meta.url), "utf8");
const playgroundSource = readFileSync(new URL("../src/demos/DisplacementPlayground.tsx", import.meta.url), "utf8");
const additionalDemosSource = readFileSync(new URL("../src/demos/AdditionalGlassDemos.tsx", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const heroSource = readFileSync(new URL("../src/HeroGlassDemo.tsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const demoStylesSource = readFileSync(new URL("../src/styles/demos.css", import.meta.url), "utf8");
const pageStylesSource = readFileSync(new URL("../src/styles/page.css", import.meta.url), "utf8");
const baseStylesSource = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");
const libraryStylesSource = readFileSync(new URL("../src/lib/style.css", import.meta.url), "utf8");
const regenSource = readFileSync(new URL("../src/lib/use-map-regen.ts", import.meta.url), "utf8");
const contextSource = readFileSync(new URL("../src/lib/context.ts", import.meta.url), "utf8");
const componentSource = readFileSync(new URL("../src/lib/components.tsx", import.meta.url), "utf8");
const pointerFallbackSource = readFileSync(new URL("../src/lib/use-pointer-release-fallback.ts", import.meta.url), "utf8");
const qrSource = readFileSync(new URL("../src/demos/QrGlassDemo.tsx", import.meta.url), "utf8");
const qrGeometrySource = readFileSync(new URL("../src/demos/qr-geometry.ts", import.meta.url), "utf8");
const qrRendererSource = readFileSync(new URL("../src/demos/qr-renderer.ts", import.meta.url), "utf8");
const qrMapSource = readFileSync(new URL("../src/demos/qr-map.ts", import.meta.url), "utf8");
const qrPaintSource = readFileSync(new URL("../src/demos/qr-paint.ts", import.meta.url), "utf8");
const videoSource = readFileSync(new URL("../src/demos/VideoGlassDemo.tsx", import.meta.url), "utf8");
const gitignoreSource = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("single-lens filter clips blur and refraction to the rounded map alpha", () => {
  assert.match(filterSource, /const units = isPool \|\| isIOS \? "userSpaceOnUse" : "objectBoundingBox"/);
  assert.match(filterSource, /<feComposite in="lensResult" in2="rawMap" operator="in" result="clippedLensResult"/);
  assert.match(filterSource, /<feComposite in="SourceGraphic" in2="rawMap" operator="out" result="holedSG"/);
  assert.match(filterSource, /<feComposite in="clippedLensResult" in2="holedSG" operator="over"/);
  assert.doesNotMatch(filterSource, /result="lensMask"/);
  assert.match(displacementSource, /data\[idx \+ 3\] = insideLens \? 255 : 0/);
  assert.match(displacementSource, /data\[iTL \+ 3\] = 0/);
  assert.match(filterSource, /in=\{isSafari \? "rawMap" : "map"\}/);
  assert.doesNotMatch(filterSource, /maskDataUrl/);
});

test("playground geometry uses motion values instead of PNG generation during React render", () => {
  assert.match(playgroundSource, /const lensW = useRef\(motionValue\(70\)\)\.current/);
  assert.match(playgroundSource, /specularStrength: values\.specularStrength/);
  assert.match(playgroundSource, /onLensMapChange=\{setMapUrl\}/);
  assert.doesNotMatch(playgroundSource, /generateLensMap\(lens\)/);
  assert.doesNotMatch(heroSource, /generateLensMap\(lens\)/);
});

test("animated map regeneration commits numeric depth and surface changes to the live filter", () => {
  assert.match(regenSource, /const genSizeRef = useRef\(0\)/);
  assert.match(regenSource, /if \(!genRef\.current \|\| genSizeRef\.current !== mapSize\)/);
  assert.match(regenSource, /opts\.depth,[\s\S]*opts\.specularRotation,[\s\S]*opts\.glowStrength,[\s\S]*opts\.edgeStrength/s);
  assert.match(regenSource, /feImageRef\.current\?\.setAttribute\("href", url\);\s*cbRef\.current\(url\)/s);
});

test("offscreen glass invalidates cached geometry before restoring its filter", () => {
  assert.match(
    filterSource,
    /if \(visible\) \{\s*lastLeftRef\.current = NaN;\s*lastTopRef\.current = NaN;\s*lastScaleRef\.current = NaN;\s*\}\s*applyLayoutRef\.current\(\)/s,
  );
});

test("small controls keep optics idle until interaction", () => {
  assert.match(filterSource, /filterEnabled\?: boolean/);
  assert.match(filterSource, /const filterActive = filterEnabled &&/);
  assert.match(filterSource, /filterEnabled \|\| animatedGeneratedRef\.current/);
  assert.equal((componentSource.match(/filterEnabled=\{opticsActive\}/g) ?? []).length, 2);
  assert.equal((componentSource.match(/filterResolution=\{compact \? 1 : 2\}/g) ?? []).length, 2);
  assert.equal((componentSource.match(/const restTintBlur = compact \? 0 : 4/g) ?? []).length, 2);
});

test("slider track clicks spring to the target and dragging takes over without a jump", () => {
  assert.match(componentSource, /const SLIDER_CLICK_SPRING = \{ mass: 0\.8, stiffness: 300, damping: 24 \}/);
  assert.match(componentSource, /clickAnimation\.current = springTo\(offset, next, SLIDER_CLICK_SPRING\)/);
  assert.match(componentSource, /if \(!pointerMoved\.current && Math\.abs\(event\.clientX - pointerStart\.current\) < 3\) return/);
  assert.match(componentSource, /clickAnimation\.current\?\.stop\(\);\s*pointerMoved\.current = true;\s*pointerStart\.current = event\.clientX;\s*offsetStart\.current = offset\.get\(\)/s);
});

test("switch and slider recover when pointer release is lost outside the viewport", () => {
  assert.match(pointerFallbackSource, /export function usePointerReleaseFallback\(onRelease: \(\) => void\)/);
  assert.match(pointerFallbackSource, /window\.addEventListener\("pointerup", finishPointer\)/);
  assert.match(pointerFallbackSource, /window\.addEventListener\("pointercancel", finishPointer\)/);
  assert.match(pointerFallbackSource, /window\.addEventListener\("blur", finish\)/);
  assert.match(pointerFallbackSource, /document\.addEventListener\("visibilitychange", finishWhenHidden\)/);
  assert.equal((componentSource.match(/armPointerFallback\(event\.pointerId\)/g) ?? []).length, 2);
  const switchSource = componentSource.slice(componentSource.indexOf("export function GlassSwitch"), componentSource.indexOf("const SLIDER_BASE"));
  const sliderSource = componentSource.slice(componentSource.indexOf("export function GlassSlider"), componentSource.indexOf("type IconProps"));
  assert.match(switchSource, /onLostPointerCapture=\{\(event\) =>/);
  assert.match(sliderSource, /onLostPointerCapture=\{\(event\) =>/);
});

test("video rendering follows visible video frames at a bounded DPR", () => {
  assert.match(videoSource, /new IntersectionObserver/);
  assert.match(videoSource, /requestVideoFrameCallback/);
  assert.match(videoSource, /Math\.min\(2\.5, 1\.25 \* \(window\.devicePixelRatio \|\| 1\)\)/);
  assert.match(videoSource, /if \(!visible\) return/);
  assert.doesNotMatch(videoSource, /frameRef\.current = requestAnimationFrame\(draw\);\s*if \(video\.readyState/s);
});

test("video buttons use source-resolution AA and source-matched elastic springs", () => {
  assert.equal((videoSource.match(/float aa = fwidth\(/g) ?? []).length, 2);
  assert.doesNotMatch(videoSource, /max\(fwidth\(/);
  assert.match(videoSource, /if \(coverage <= 0\.001\) \{\s*fragColor = videoAt\(v_uv\);\s*return;\s*\}/s);
  assert.match(videoSource, /const SIDE_BUTTON_SPRING = \{ stiffness: 1000, damping: 40, mass: 1\.5 \}/);
  assert.match(videoSource, /const PLAY_BUTTON_SPRING = \{ stiffness: 500, damping: 32, mass: 1 \}/);
  assert.match(videoSource, /const BUTTON_HOVER_SCALE = 1\.045/);
  assert.match(videoSource, /hoverRef\.current\[index\] \? BUTTON_HOVER_SCALE : 1/);
  assert.doesNotMatch(videoSource, /current \+ \(target - current\) \* 0\.2/);
});

test("paused seeking refreshes the video texture and the seek bar springs", () => {
  assert.match(videoSource, /const textureDirtyRef = useRef\(true\)/);
  assert.match(videoSource, /video\.addEventListener\("seeked", onSeeked\)/);
  assert.match(videoSource, /uploadVideo \|\| textureDirtyRef\.current \|\| !textureReady/);
  assert.match(videoSource, /const BAR_DRAG_SPRING = \{ stiffness: 550, damping: 35, mass: 1 \}/);
  assert.match(videoSource, /barStretchTargetRef\.current = seekRubberBand/);
  assert.match(videoSource, /const barWidth = layout\.bar\[2\] \+ Math\.abs\(barStretch\)/);
  assert.match(videoSource, /const barCenterX = layout\.bar\[0\] \+ barStretch \* 0\.5/);
  assert.match(videoSource, /bar\.style\.transformOrigin = barStretch >= 0 \? "0 50%" : "100% 50%"/);
  assert.match(videoSource, /bar\.style\.transform = `scaleX\(\$\{1 \+ Math\.abs\(barStretch\) \/ layout\.bar\[2\]\}\)`/);
  assert.doesNotMatch(videoSource, /barPressRef|barPressTargetRef|barHeight/);
});

test("video seeking recovers after leaving the viewport", () => {
  assert.match(videoSource, /usePointerReleaseFallback\(finishSeek\)/);
  assert.match(videoSource, /const seekPointerRef = useRef<number \| null>\(null\)/);
  assert.match(videoSource, /barRef\.current\?\.hasPointerCapture\(activePointerId\)/);
  assert.match(videoSource, /barStretchTargetRef\.current = 0/);
  assert.match(videoSource, /onLostPointerCapture=\{endSeek\}/);
});

test("accepted switch, slider, and toggle stay mounted through the exact reusable controls", () => {
  assert.match(controlGallerySource, /<GlassSwitch/);
  assert.match(controlGallerySource, /<GlassSlider value=\{amount\}/);
  assert.match(controlGallerySource, /<GlassSegmented value=\{segment\}/);
  assert.match(controlGallerySource, /<ControlPanel title=\{text\.button\} wide>[\s\S]*<GlassActionDemo label=\{text\.hold\} \/>/s);
  assert.doesNotMatch(appSource, /id="interactions"|title="交互"|<GlassActionDemo/);
});

test("switch and slider expose a small size without changing default geometry", () => {
  assert.equal((componentSource.match(/size\?: "default" \| "small"/g) ?? []).length, 2);
  assert.match(componentSource, /const width = compact \? 52 : 74/);
  assert.match(componentSource, /const height = compact \? 20 : 28/);
  assert.match(componentSource, /const width = compact \? 120 : 240/);
  assert.match(componentSource, /const thumbHeight = compact \? 16 : 22/);
  assert.match(componentSource, /const trackHeight = compact \? 4 : 6/);
  assert.match(playgroundSource, /<GlassSlider[\s\S]*size="small"/);
  assert.equal((playgroundSource.match(/<GlassSwitch/g) ?? []).length, 2);
  assert.equal((playgroundSource.match(/size="small"/g) ?? []).length, 3);
  assert.doesNotMatch(playgroundSource, /type="range"/);
});

test("dark switch uses its own neutral enabled color", () => {
  assert.match(libraryStylesSource, /html\[data-theme="dark"\] \.dg-switch\s*\{\s*--dg-switch-on:\s*#777773/);
  assert.match(libraryStylesSource, /var\(--dg-switch-on, var\(--primary\)\)/);
});

test("action glass stays icon-free and uses a neutral dark material", () => {
  assert.doesNotMatch(additionalDemosSource, /Sparkles|<svg/);
  assert.match(additionalDemosSource, /tintColor="var\(--action-glass-tint\)"/);
  assert.match(baseStylesSource, /--action-glass-tint:\s*#fff/);
  assert.match(baseStylesSource, /:root\[data-theme="dark"\][\s\S]*--action-glass-tint:\s*#4a4a46/s);
});

test("switch, slider, and toggle retain their source motion contracts", () => {
  assert.match(componentSource, /const offset = useMotionValue\(current \? travel : 0\)/);
  assert.match(componentSource, /window\.setTimeout\(\(\) => \{[\s\S]*mode\.current === "pending"[\s\S]*\}, 200\)/);
  assert.match(componentSource, /animate\(tintOpacity, 0, pressTransition\)/);
  assert.match(componentSource, /rubberBand\(-next, overshoot/);
  assert.match(componentSource, /inputRef\.current\?\.focus/);
  assert.doesNotMatch(componentSource, /dg-slider__value/);
  assert.match(componentSource, /filterResolution=\{compact \? 1 : 2\}/);
  assert.match(componentSource, /duration: 0\.6/);
  assert.match(componentSource, /return Math\.min\(0\.46, speed \*\* 0\.62 \* 0\.0095\)/);
  assert.match(componentSource, /zoom=\{zoom\}/);
  assert.match(componentSource, /depth=\{boostedDepth\}/);
  assert.match(componentSource, /refracted \? color1 : "#bcbbbb"/);
});

test("QR demo uses the source procedural geometry and expanding WebGL refraction", () => {
  assert.match(qrGeometrySource, /QRCode\.create\("https:\/\/glass-ui\.dev", \{ errorCorrectionLevel: "Q" \}\)/);
  assert.match(qrRendererSource, /gl\.R8/);
  assert.match(qrRendererSource, /float scaleR = 1\.0 \+ u_chromaAmount \* 2\.0/);
  assert.match(qrSource, /const MAX_HALF_SIZE = 162 \* 2\.2/);
  assert.match(qrSource, /Array<\{ slot: number; started: number \}>/);
  assert.match(qrMapSource, /class QrWaveComposer/);
  assert.match(qrPaintSource, /class QrPaintTexture/);
  assert.match(appSource, /<QrGlassDemo locale=\{locale\} \/>/);
  assert.match(demoStylesSource, /\.dg-qr__icon-rotator[^}]*inset:\s*0/s);
  assert.match(demoStylesSource, /\.dg-qr__icon-face[^}]*inset:\s*0/s);
});

test("QR icon side wall stays inside the rounded face while rotating", () => {
  assert.match(demoStylesSource, /\.dg-qr__icon-edge[^}]*height:\s*calc\(100% - 2px\)[^}]*border-radius:\s*4px/s);
  assert.match(demoStylesSource, /\.dg-qr__icon-edge[^}]*top:\s*1px/s);
  assert.doesNotMatch(demoStylesSource, /\.dg-qr__icon-edge[^}]*scaleY\(/s);
  assert.doesNotMatch(demoStylesSource, /\.dg-qr__icon-edge[^}]*translateY\(/s);
});

test("demo copy supports persisted Chinese and English while branding stays neutral", () => {
  assert.match(indexSource, /<html lang="zh-CN">/);
  assert.match(appSource, /controls: "控件"/);
  assert.match(appSource, /controls: "Controls"/);
  assert.match(appSource, /localStorage\.setItem\("glass-locale", locale\)/);
  assert.match(appSource, /document\.documentElement\.lang = locale === "zh" \? "zh-CN" : "en"/);
  assert.match(appSource, /<ControlGallery locale=\{locale\} \/>/);
  assert.match(controlGallerySource, /labels: \{ hubs: "Center", spokes: "Branches"/);
  assert.match(playgroundSource, /specularRotation: "Highlight angle"/);
  assert.match(qrSource, /Interactive glass QR code/);
  assert.match(videoSource, /Glass also works with complex interactive media/);
  assert.doesNotMatch(appSource, /为 Web 构建液态玻璃|一套可复用的实时折射组件|点击中心/);
  assert.doesNotMatch(playgroundSource, /左侧是折射结果，右侧是位移图/);
  assert.doesNotMatch(appSource, /Dezin Glass|Dezin logo|wordmark/);
  assert.doesNotMatch(qrGeometrySource, /dezin\.com/);
  assert.match(qrSource, /ScanQrCode/);
});

test("segmented control supports mouse press-drag tab switching", () => {
  assert.match(componentSource, /event\.pointerType !== "mouse"/);
  assert.match(componentSource, /moveDrag\(event\.clientX\)/);
  assert.match(componentSource, /setPointerCapture\(event\.pointerId\)/);
  assert.match(componentSource, /suppressDragClick/);
  assert.doesNotMatch(libraryStylesSource, /cursor:\s*(?:grab|grabbing)/);
});

test("segmented quick click-to-drag springs from the current glass position to the live pointer", () => {
  assert.match(componentSource, /const SEGMENTED_DRAG_CATCHUP_SPRING = \{ mass: 0\.7, stiffness: 360, damping: 28 \}/);
  assert.match(componentSource, /const dragCatchup = useMotionValue\(0\)/);
  assert.match(componentSource, /const currentCenter = expandedLeft \+ x\.get\(\) \* expandedWidth/);
  assert.match(componentSource, /dragCatchup\.set\(clientX - currentCenter\)/);
  assert.match(componentSource, /dragCatchupAnimation\.current = animate\(dragCatchup, 0, \{[\s\S]*SEGMENTED_DRAG_CATCHUP_SPRING[\s\S]*onUpdate: \(\) => moveDrag\(dragClientX\.current\)/s);
  assert.match(componentSource, /clientX - dragOffsetX\.current - dragCatchup\.get\(\)/);
});

test("segmented control is solid at rest and directly tracks drag as glass", () => {
  assert.match(componentSource, /const interaction = useMotionValue\(0\)/);
  assert.match(componentSource, /const pointerX = useMotionValue\(0\)/);
  assert.match(componentSource, /useVelocityDeformation\(pointerX/);
  assert.match(componentSource, /pointerX\.set\(centerX\)/);
  assert.match(componentSource, /width \* \(1 \+ amount \* 1\.45\)/);
  assert.match(componentSource, /height \* \(1 - amount \* 0\.52\)/);
  assert.match(componentSource, /const nearestSegment = \(clientX: number\)/);
  assert.match(componentSource, /const nextX = \(centerX - expandedLeft\) \/ expandedWidth/);
  assert.match(componentSource, /x\.set\(nextX\)/);
  assert.match(componentSource, /className="dg-tabs__solid-thumb"/);
  assert.match(componentSource, /className="dg-tabs__glass-layer"/);
  assert.match(libraryStylesSource, /\.dg-tabs__solid-thumb[^}]*background:\s*rgba\(18, 18, 22, \.08\)/s);
  assert.doesNotMatch(libraryStylesSource, /\.dg-tabs__solid-thumb[^}]*background:\s*var\(--primary\)/s);
  assert.match(componentSource, /const solidOpacity = useMotionValue\(1\)/);
  assert.match(componentSource, /<motion\.div className="dg-tabs__glass-layer" aria-hidden style=\{\{ opacity: glassOpacity \}\}>/);
  assert.doesNotMatch(libraryStylesSource, /dg-tabs__item:nth-child/);
});

test("segmented click expands, travels as glass, then collapses", () => {
  assert.match(componentSource, /return x\.on\("change", \(position\) => \{[\s\S]*pointerX\.set\(expandedLeft \+ position \* expandedWidth\)/);
  assert.match(componentSource, /choose\(nearest\.value\);\s*travelSettled\.current = updateGeometry\(nearest\.value, false\);/);
  assert.match(componentSource, /if \(dragMoved\.current\) moveDrag\(event\.clientX\)/);
  assert.match(componentSource, /releaseInteraction\(dragMoved\.current \? 0 : 90, dragMoved\.current\)/);
  assert.match(componentSource, /const releaseInteraction = \(delay = 0, settle = true\)/);
  assert.match(componentSource, /const travel = settle \? updateGeometry\(selectedRef\.current, false\) : travelSettled\.current/);
  assert.match(componentSource, /width \* \(1 \+ amount \* 0\.32\)/);
  assert.match(componentSource, /height \* \(1 \+ amount \* 0\.48\)/);
});

test("segmented edge items stay centered and the selected fill stays flat", () => {
  assert.match(componentSource, /const SEGMENTED_PAD_X = 80/);
  assert.match(componentSource, /const firstCenter = visible\[0\]\.rect\.left \+ visible\[0\]\.rect\.width \/ 2/);
  assert.match(componentSource, /Math\.max\(firstCenter, Math\.min\(lastCenter, clientX - dragOffsetX\.current - dragCatchup\.get\(\)\)\)/);
  assert.doesNotMatch(componentSource, /rootRect\.left \+ halfWidth/);
  assert.match(componentSource, /springTo\(x, nextX, SEGMENTED_TRAVEL_SPRING\)/);
  assert.doesNotMatch(libraryStylesSource, /\.dg-tabs__solid-thumb\s*\{[^}]*box-shadow/s);
  assert.doesNotMatch(libraryStylesSource, /html\[data-theme="dark"\] \.dg-tabs__solid-thumb[^}]*box-shadow/s);
});

test("segmented idle selection restores each icon's own colors", () => {
  assert.match(componentSource, /"--dg-icon-active-1": color1/);
  assert.match(componentSource, /"--dg-icon-active-2": color2/);
  assert.match(libraryStylesSource, /--dg-icon-color-1:\s*var\(--dg-icon-active-1\) !important/);
  assert.match(libraryStylesSource, /--dg-icon-color-2:\s*var\(--dg-icon-active-2\) !important/);
});

test("segmented motion uses velocity-preserving iOS-style physical springs", () => {
  assert.match(componentSource, /const SEGMENTED_TRAVEL_SPRING = \{ mass: 1, stiffness: 157\.9, damping: 17\.6 \}/);
  assert.match(componentSource, /const SEGMENTED_PRESS_SPRING = \{ mass: 0\.9, stiffness: 190, damping: 18 \}/);
  assert.match(componentSource, /const SEGMENTED_RELEASE_SPRING = \{ mass: 1, stiffness: 150, damping: 19 \}/);
  assert.match(componentSource, /velocity: value\.getVelocity\(\)/);
  assert.match(componentSource, /const x = useMotionValue\(0\.5\)/);
  assert.match(componentSource, /springTo\(interaction, 1, SEGMENTED_PRESS_SPRING\)/);
  assert.match(componentSource, /springTo\(interaction, 0, SEGMENTED_RELEASE_SPRING\)/);
  assert.doesNotMatch(componentSource, /let velocity = 0;[\s\S]*velocity \+= \(stiffness/);
});

test("segmented glass attenuation overlaps the low-amplitude travel tail", () => {
  assert.match(componentSource, /const glassOpacity = useMotionValue\(0\)/);
  assert.match(componentSource, /Promise\.all\(\[shape\.finished, height\.finished\]\)/);
  assert.match(componentSource, /waitForRest\(deformation, 0\.045, 500, 16\)/);
  assert.match(componentSource, /epsilon = 0\.015, timeoutMs = 900, holdMs = 50/);
  assert.match(componentSource, /restTimer = window\.setTimeout\(finish, holdMs\)/);
  assert.match(componentSource, /animate\(glassOpacity, 0, \{ duration: 0\.265, ease: \[0\.4, 0, 0\.2, 1\] \}\)/);
  assert.doesNotMatch(componentSource, /setTimeout\(\(\) => \{\s*rootRef\.current\?\.removeAttribute\("data-interacting"\)/);
  assert.doesNotMatch(libraryStylesSource, /\.dg-tabs__solid-thumb\s*\{[^}]*opacity 90ms/s);
});

test("segmented braking squashes both axes and hover stays subtle", () => {
  assert.match(componentSource, /stiffness: \(\) => impactLanded\.current && stationaryPress\(\) \? SEGMENTED_HOLD_IMPACT_SCRIPT\.stiffness : 210/);
  assert.match(componentSource, /if \(!impactLanded\.current\) return 15\.5/);
  assert.match(componentSource, /return 19\.5/);
  assert.match(componentSource, /typeof options\.stiffness === "function" \? options\.stiffness\(\) : options\.stiffness/);
  assert.match(componentSource, /typeof options\.damping === "function" \? options\.damping\(\) : options\.damping/);
  assert.match(componentSource, /width \* \(1 \+ amount \* 1\.45\)/);
  assert.match(componentSource, /height \* \(1 - amount \* 0\.52\)/);
  assert.match(libraryStylesSource, /\.dg-tabs__item:not\(\[data-selected\]\):hover\s*\{\s*background:\s*rgba\(18, 18, 22, \.035\)/s);
});

test("segmented arrival pins most velocity stretch behind the leading edge", () => {
  assert.match(componentSource, /const SEGMENTED_IMPACT_RETENTION = 0\.18/);
  assert.match(componentSource, /const SEGMENTED_TRAIL_BIAS = 0\.82/);
  assert.match(componentSource, /const impactTargetX = useRef\(0\.5\)/);
  assert.match(componentSource, /const impactDirection = useRef\(0\)/);
  assert.match(componentSource, /const impactLanded = useRef\(false\)/);
  assert.match(componentSource, /impactLanded\.current = true/);
  assert.match(componentSource, /if \(impactLanded\.current\) return 0/);
  assert.match(componentSource, /impactLanded\.current = false/);
  assert.match(componentSource, /const impactX = useDerivedMotion2\(x, deformation/);
  assert.match(componentSource, /const retainedOvershoot = impactLanded\.current \|\| overshoot > 0 \? overshoot \* SEGMENTED_IMPACT_RETENTION : overshoot/);
  assert.match(componentSource, /const softened = target \+ direction \* retainedOvershoot/);
  assert.match(componentSource, /velocityStretch \* SEGMENTED_TRAIL_BIAS/);
  assert.match(componentSource, /x=\{impactX\}/);
});

test("segmented stationary long press settles without being treated as a drag", () => {
  assert.match(componentSource, /const trackingPointer = dragPointer\.current !== null && dragMoved\.current/);
  assert.match(componentSource, /if \(!trackingPointer && direction !== 0\)/);
  assert.match(componentSource, /if \(stationaryPress\(\)\) return SEGMENTED_HOLD_IMPACT_SCRIPT\.damping/);
  assert.doesNotMatch(componentSource, /if \(dragPointer\.current === null && direction !== 0\)/);
});

test("segmented stationary hold uses one explicit Q-bounce impact script", () => {
  assert.match(componentSource, /const SEGMENTED_HOLD_IMPACT_SCRIPT = \{\s*stiffness: 360,\s*damping: 24,\s*impulse: -7,\s*\} as const/s);
  assert.match(componentSource, /const velocityImpulseRef = useRef\(0\)/);
  assert.match(componentSource, /velocity \+= velocityImpulseRef\.current/);
  assert.match(componentSource, /velocityImpulseRef\.current = 0/);
  assert.match(componentSource, /if \(!impactLanded\.current && \(x\.get\(\) - impactTargetX\.current\) \* direction >= 0\)/);
  assert.match(componentSource, /impactKickRef\.current\(SEGMENTED_HOLD_IMPACT_SCRIPT\.impulse\)/);
});

test("segmented glass stays slightly taller than the tab group", () => {
  assert.match(componentSource, /const glassHeight = useMotionValue\(0\)/);
  assert.match(componentSource, /const heightBoost = useDerivedMotion2\(glassHeight, deformation, \(active, amount\) =>\s*active \* \(0\.34 - Math\.min\(0\.22, Math\.max\(0, amount\) \* 0\.72\)\)\)/s);
  assert.match(componentSource, /const minimumGlassH = useDerivedMotion2\(lensH, heightBoost, \(height, boost\) => height \* \(1 \+ boost\)\)/);
  assert.match(componentSource, /const renderedLensH = useDerivedMotion2\(expandedLensH, minimumGlassH, \(height, minimum\) => Math\.max\(height, minimum\)\)/);
  assert.match(componentSource, /glassHeight\.set\(1\)/);
  assert.match(componentSource, /springTo\(glassHeight, 0, SEGMENTED_HEIGHT_RELEASE_SPRING\)/);
  assert.doesNotMatch(componentSource, /useDerivedMotion2\(lensH, glassOpacity/);
});

test("segmented vertical boost collapses during settling instead of lingering", () => {
  assert.match(componentSource, /const SEGMENTED_HEIGHT_RELEASE_SPRING = \{ mass: 0\.8, stiffness: 260, damping: 23\.6 \}/);
  assert.match(componentSource, /heightStop\.current = height/);
  assert.match(componentSource, /heightStop\.current\?\.stop\(\);\s*glassHeight\.set\(1\)/);
  assert.doesNotMatch(componentSource, /fade\.then\(\(\) => \{[\s\S]*glassHeight\.set\(0\)/);
});

test("segmented final crossfade keeps content colors stable and compositor-only", () => {
  assert.match(componentSource, /<motion\.span ref=\{solidThumbRef\} className="dg-tabs__solid-thumb" aria-hidden style=\{\{ opacity: solidOpacity \}\} \/>/);
  assert.doesNotMatch(componentSource, /style\.setProperty\("--segmented-glass"/);
  assert.match(componentSource, /setAttribute\("data-crossfading", ""\)/);
  assert.match(componentSource, /removeAttribute\("data-crossfading"\)/);
  assert.match(libraryStylesSource, /\.dg-tabs > \.dg-tabs__group > \.dg-tabs__item\[data-selected\][^}]*color:\s*var\(--fg-1\)/s);
  assert.match(libraryStylesSource, /\.dg-tabs\[data-crossfading\] \.dg-tabs__group--glass-base \.dg-tabs__item\[data-selected\]/);
});

test("segmented final state attenuates optics over an already-present base material", () => {
  assert.match(componentSource, /animate\(solidOpacity, 0, \{ duration: 0\.1/);
  assert.match(componentSource, /solidOpacity\.set\(1\);\s*rootRef\.current\?\.setAttribute\("data-crossfading", ""\)/);
  assert.doesNotMatch(componentSource, /animate\(solidOpacity, 1/);
});

test("video demo refracts one live texture through three lenses and the seek bar", () => {
  assert.match(videoSource, /uniform vec3 u_circles\[3\]/);
  assert.match(videoSource, /new Float32Array\(\[0\.04, 0\.07, 0\.04\]\)/);
  assert.match(videoSource, /playSize = 111/);
  assert.match(videoSource, /sideSize = 65/);
  assert.match(videoSource, /u_bar/);
  assert.match(videoSource, /float coverage = clamp\(mask \* strength, 0\.0, 1\.0\)/);
  assert.match(videoSource, /displacement \* baseScale \* coverage/);
  assert.match(videoSource, /specular\) \* 0\.498 \* coverage/);
  assert.doesNotMatch(videoSource, /backdrop-filter/);
  assert.match(videoSource, /\.svg\?raw/);
  assert.match(appSource, /<VideoGlassDemo locale=\{locale\} \/>/);
});

test("how-it-works keeps source structure and smooth map sampling", () => {
  assert.match(appSource, /<DisplacementPlayground backgroundImage=\{HERO_PHOTO_URL\} locale=\{locale\} \/>/);
  assert.doesNotMatch(demoStylesSource, /displacement-playground__map[^}]*image-rendering:\s*pixelated/s);
  assert.doesNotMatch(playgroundSource, /PlaygroundParticles|👻|💜|👀|🛹/);
  assert.match(playgroundSource, /const \[showBackground, setShowBackground\] = useState\(false\)/);
  assert.match(playgroundSource, /<GlassSwitch[\s\S]*checked=\{showBackground\}[\s\S]*onCheckedChange=\{setShowBackground\}/);
  assert.match(playgroundSource, /showBackground \? \([\s\S]*backgroundImage/);
  assert.match(playgroundSource, /edgeShadow: values\.shadowOpacity > 0/);
  assert.doesNotMatch(playgroundSource, /0 0 0 1px var\(--bg-max\)/);
  assert.match(regenSource, /surfaceRafRef\.current = requestAnimationFrame/);
});

test("experiment exposes every remaining optical parameter in a collapsed advanced section", () => {
  assert.match(playgroundSource, /<details className="displacement-playground__advanced"/);
  assert.match(playgroundSource, /<summary>\{text\.more\}<\/summary>/);
  for (const key of [
    "scaleX",
    "scaleY",
    "mapSize",
    "brightness",
    "tint",
    "glowSpread",
    "glowExponent",
    "edgeWidth",
    "edgeExponent",
    "zoom",
    "filterResolution",
    "regionScale",
    "regionOriginX",
    "regionOriginY",
    "shadowOpacity",
    "insetShadowOpacity",
  ]) {
    assert.match(playgroundSource, new RegExp(`${key}: \\[`));
  }
  for (const flag of ["sdfBoundary", "edgeFalloff", "specularDark"]) {
    assert.match(playgroundSource, new RegExp(`${flag}: (?:true|false)`));
  }
  assert.match(playgroundSource, /scaleX: values\.scaleX/);
  assert.match(playgroundSource, /scaleY: values\.scaleY/);
  assert.match(playgroundSource, /filterResolution=\{values\.filterResolution\}/);
  assert.match(playgroundSource, /regionScale=\{values\.regionScale\}/);
  assert.match(playgroundSource, /mapSize: \[512, 64, 1024, 64\]/);
  assert.match(playgroundSource, /specularRotation: \[45, 0, 360, 1\]/);
});

test("experiment memoizes parameter rows and keeps callbacks stable", () => {
  assert.match(playgroundSource, /const ParameterSlider = memo\(function ParameterSlider/);
  assert.match(playgroundSource, /const setValue = useCallback\(/);
  assert.match(playgroundSource, /basicOrder\.map\(\(key\) => \(\s*<ParameterSlider/s);
});

test("footer persists theme and locale with icon and language controls", () => {
  assert.match(appSource, /const \[theme, setTheme\] = useState<"light" \| "dark">/);
  assert.match(appSource, /localStorage\.setItem\("glass-theme", theme\)/);
  assert.match(appSource, /document\.documentElement\.dataset\.theme = theme/);
  assert.match(appSource, /className="footer-tool footer-theme"/);
  assert.match(appSource, /<Sun aria-hidden="true" \/> : <Moon aria-hidden="true" \/>/);
  assert.match(appSource, /className="footer-tool footer-language"/);
  assert.match(appSource, /locale === "zh" \? "中" : "EN"/);
  assert.match(pageStylesSource, /\.footer-tool svg[^}]*width:\s*14px/);
  assert.match(baseStylesSource, /:root\[data-theme="dark"\]/);
  assert.match(pageStylesSource, /\.site-footer[^}]*justify-content:\s*space-between/s);
});

test("demo architecture, Fontsource typography, and new interactions stay mounted", () => {
  assert.match(mainSource, /@fontsource-variable\/manrope/);
  assert.match(mainSource, /@fontsource-variable\/noto-sans-sc/);
  assert.match(stylesSource, /@import "\.\/styles\/base\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/page\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/demos\.css"/);
  assert.match(pageStylesSource, /\.hero__visual\s*\{[^}]*margin-top:\s*0/s);
  assert.doesNotMatch(pageStylesSource, /\.hero\s*\{[^}]*grid-template-columns/s);
  assert.doesNotMatch(appSource, /useActiveSection|data-theme|onToggleTheme/);
  assert.doesNotMatch(appSource, /SiteChrome|site-header/);
  assert.doesNotMatch(pageStylesSource, /position:\s*sticky|@keyframes page-enter/);
  assert.match(additionalDemosSource, /export function GlassActionDemo/);
  assert.doesNotMatch(additionalDemosSource, /GlassTargetGridDemo|RefractionTarget/);
});

test("runtime styling uses the project-owned namespace and private references stay ignored", () => {
  const runtimeSource = [componentSource, heroSource, qrSource, videoSource, libraryStylesSource, demoStylesSource].join("\n");
  assert.match(runtimeSource, /dg-(?:control|switch|slider|tabs|hero|qr|video)/);
  assert.match(filterSource, /data-dg-glass-surface=""/);
  assert.match(contextSource, /\[data-dg-glass-surface\]/);
  assert.match(videoSource, /\.\.\/assets\/video\/pause\.svg\?raw/);
  assert.match(gitignoreSource, /^\.openai\/$/m);
  assert.match(gitignoreSource, /^\.dezin\/$/m);
});

test("minimal layout removes the two untracked circular decorations above the hero glass", () => {
  assert.doesNotMatch(pageStylesSource, /site-header nav a::after/);
  assert.doesNotMatch(pageStylesSource, /\.theme-button[^}]*border-radius:\s*50%/s);
  assert.doesNotMatch(baseStylesSource, /radial-gradient/);
  assert.doesNotMatch(additionalDemosSource, /action-demo__orbit/);
  assert.doesNotMatch(appSource, /局部折射/);
  assert.doesNotMatch(appSource, /hero__facts|principles|implementation__notes/);
});

test("button, QR, and experiment grids stay centered within their stages", () => {
  assert.match(demoStylesSource, /\.action-demo__surface[\s\S]*?background-position: center/);
  assert.match(demoStylesSource, /\.displacement-playground__background \{[^}]*background-position: center/);
  assert.match(pageStylesSource, /\.media-panel__stage \{[^}]*background-position: center/);
});

test("hero stays interactive over a real monochrome photograph", () => {
  assert.match(appSource, /lensW: 140,\s*lensH: 140,\s*borderRadius: 140,[\s\S]*chromaAmount: 0\.24/s);
  assert.match(appSource, /images\.unsplash\.com\/photo-1683318854587-3722ba210558/);
  assert.match(appSource, /<HeroGlassDemo lens=\{HERO_LENS\} backgroundImage=\{HERO_PHOTO_URL\}/);
  assert.doesNotMatch(appSource, /interactive=\{false\}/);
  assert.doesNotMatch(heroSource, /Sparkles|dg-hero__icon-layer|dg-hero__neutral-mark/);
  assert.match(additionalDemosSource, /<\/Glass>\s*<button\s*className="action-demo__button"/s);
  assert.doesNotMatch(additionalDemosSource, /aria-live|本次会话已生成/);
  assert.match(demoStylesSource, /\.action-demo__button[^}]*top:\s*50%[^}]*left:\s*50%[^}]*translate\(-50%, -50%\)/s);
});

test("segmented glass adds dispersion without changing its motion physics", () => {
  assert.match(componentSource, /const SEGMENTED_CHROMA_AMOUNT = 0\.24/);
  assert.equal((componentSource.match(/chromaAmount: SEGMENTED_CHROMA_AMOUNT/g) ?? []).length, 2);
  assert.match(componentSource, /SEGMENTED_TRAVEL_SPRING = \{ mass: 1, stiffness: 157\.9, damping: 17\.6 \}/);
  assert.match(componentSource, /SEGMENTED_HOLD_IMPACT_SCRIPT = \{\s*stiffness: 360,\s*damping: 24,\s*impulse: -7,/s);
});

test("approved controls and media stay locked after the performance pass", () => {
  assert.equal(sha256(componentSource), "a9bc7e5013a1eed9a1ce8f1126ada035d3e4ce2e6f0cc3fdad6da083fa8cca68");
  assert.equal(sha256(qrSource), "c541d7c3a7d58dbef77593077fd5ac0a4cdbbf55875da60fef0f91d8ca7435b7");
  assert.equal(sha256(videoSource), "42cd7cf94a51d7ee48a027b3b120e621f52f740f03774997ebf2f3d22a1b2cbc");
  assert.equal(sha256(qrRendererSource), "31fa7f5b060752843d9e99c37c51066c80af0bbb3db19fb48788052836a71322");
  assert.equal(sha256(qrMapSource), "2ba106207efe3a14b8bab03d25863c29756da5fe0d30807817445e27ceb01c0c");
});

test("source defaults and motion primitive stay stable", () => {
  assert.equal(DEFAULT_LENS_PARAMS.mapSize, 256);
  assert.equal(PLAYGROUND_DEFAULTS.mapSize, 512);
  assert.equal(PLAYGROUND_DEFAULTS.scaleX, 0.07);
  assert.equal(axisScaleMatrix(1, 0.5), "1 0 0 0 0  0 0.5 0 0 0.25  0 0 1 0 0  0 0 0 1 0");
  const value = motionValue(1);
  let observed = 0;
  const unsubscribe = value.on("change", (next) => { observed = next; });
  value.set(2);
  unsubscribe();
  assert.equal(observed, 2);
});
