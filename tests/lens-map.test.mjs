import { liquidContentPose, liquidContentOptics } from "../packages/react-liquid-glass/dist/liquid-glass.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import {
  liquidEasings,
  OPEN_MORPH_TIMES,
  CLOSE_FUSION_TIMES,
  openWidthFrames,
  openHeightFrames,
  openRadiusFrames,
  closeMenuWidthFrames,
  closeMenuHeightFrames,
  closeMenuRadiusFrames,
  closeButtonFrames,
  retargetLiquidFrames,
} from "../packages/react-liquid-glass/dist/apple-motion.js";
import {
  DEFAULT_LENS_PARAMS,
  PLAYGROUND_DEFAULTS,
  axisScaleMatrix,
  motionValue,
  LIQUID_GLASS_MATERIAL,
} from "../packages/react-liquid-glass/dist/index.js";

const filterSource = readFileSync(
  process.env.FILTER_SOURCE ?? new URL("../packages/react-liquid-glass/src/glass.tsx", import.meta.url),
  "utf8",
);
const displacementSource = readFileSync(new URL("../packages/react-liquid-glass/src/displacement-map.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../apps/docs/src/App.tsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../apps/docs/src/main.tsx", import.meta.url), "utf8");
const libraryIndexSource = readFileSync(new URL("../packages/react-liquid-glass/src/index.ts", import.meta.url), "utf8");
const libraryConfigSource = readFileSync(new URL("../packages/react-liquid-glass/vite.config.mjs", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../packages/react-liquid-glass/package.json", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const additionalDemosSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassActionButton.tsx", import.meta.url), "utf8");
const liquidDemoSource = [
  "lib/controls/LiquidMenu.tsx", "lib/apple-motion/use-menu-motion.ts",
  "lib/controls/use-menu-material.ts", "lib/apple-motion/menu.ts",
].map(path => readFileSync(new URL(`../${path.startsWith("lib/") ? "packages/react-liquid-glass/src/" + path.slice(4) : "apps/docs/src/" + path}`, import.meta.url), "utf8")).join("\n");
const liquidCanvasUrl = new URL("../packages/react-liquid-glass/src/liquid-glass/LiquidGlassCanvas.tsx", import.meta.url);
const liquidRendererSource = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/renderer.ts", import.meta.url), "utf8");
const liquidAdapterSource = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/LiquidGlass.tsx", import.meta.url), "utf8");
const liquidCanvasSource = readFileSync(liquidCanvasUrl, "utf8") + liquidRendererSource;
const indexSource = readFileSync(new URL("../apps/docs/index.html", import.meta.url), "utf8");
const heroSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassSpotlight.tsx", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/tween.ts", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../apps/docs/src/styles.css", import.meta.url), "utf8");
const demoStylesSource = readFileSync(new URL("../apps/docs/src/styles/demos.css", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/controls.css", import.meta.url), "utf8");
const pageStylesSource = readFileSync(new URL("../apps/docs/src/styles/page.css", import.meta.url), "utf8");
const baseStylesSource = readFileSync(new URL("../apps/docs/src/styles/base.css", import.meta.url), "utf8");
const libraryStylesSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls.css", import.meta.url), "utf8");
const regenSource = readFileSync(new URL("../packages/react-liquid-glass/src/use-map-regen.ts", import.meta.url), "utf8");
const contextSource = readFileSync(new URL("../packages/react-liquid-glass/src/context.ts", import.meta.url), "utf8");
const componentSource = [
  "apple-motion/react.ts", "controls/use-thumb-motion.ts", "controls/GlassSwitch.tsx",
  "apple-motion/presets.ts", "controls/GlassSlider.tsx", "controls/GlassSegmented.tsx",
].map(path => readFileSync(new URL(`../packages/react-liquid-glass/src/${path}`, import.meta.url), "utf8")).join("\n");
const pointerFallbackSource = readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/use-pointer-release-fallback.ts", import.meta.url), "utf8");
const videoSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassVideo.tsx", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/spring.ts", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/presets.ts", import.meta.url), "utf8");
const gitignoreSource = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("single-lens filter clips blur and refraction to the rounded map alpha", () => {
  assert.match(filterSource, /specularOpacity\?: MotionInput/);
  assert.match(filterSource, /const mainSpecularRef = useRef<SVGFECompositeElement \| null>\(null\)/);
  assert.match(filterSource, /merged\.specularStrength \* readMotion\(specularOpacity \?\? 1\)/);
  assert.match(filterSource, /mainSpecularRef\.current\?\.setAttribute\("k2", String\(strength\)\)/);
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

test("small controls retain sharp 2x Liquid surfaces and only draw when dirty", () => {
  assert.match(filterSource, /filterEnabled\?: boolean/);
  assert.match(filterSource, /const filterActive = filterEnabled &&/);
  assert.match(filterSource, /filterEnabled \|\| animatedGeneratedRef\.current/);
  assert.equal((componentSource.match(/sourceFactory=\{sourceFactory\}/g) ?? []).length, 2);
  assert.match(liquidCanvasSource, /frame\.render\(drawFrame\)/);
  assert.match(liquidCanvasSource, /if \(!visible \|\| document\.hidden \|\| !source\) return/);
  assert.doesNotMatch(liquidAdapterSource, /requestAnimationFrame|toDataURL/);
  assert.equal((componentSource.match(/filterResolution=\{2\}/g) ?? []).length, 2, "small thumbs must not upscale 1x coverage on Retina screens");
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
  assert.equal((componentSource.match(/armPointerFallback\(event\.pointerId\)/g) ?? []).length, 3);
  const switchSource = componentSource.slice(componentSource.indexOf("export function GlassSwitch"), componentSource.indexOf("const SLIDER_CLICK_SPRING"));
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
  assert.match(videoSource, /createLiquidGlassRenderer\(canvas/);
  assert.match(liquidRendererSource, /float aa = max\(fwidth\(distance\), \.0001\)/);
  assert.match(liquidRendererSource, /displacement \*= coverage \* uZoom/);
  assert.match(liquidRendererSource, /coverage \* uOpacity/);
  assert.match(videoSource, /const SIDE_BUTTON_SPRING = \{ stiffness: 1000, damping: 40, mass: 1\.5 \}/);
  assert.match(videoSource, /const PLAY_BUTTON_SPRING = \{ stiffness: 500, damping: 32, mass: 1 \}/);
  assert.match(videoSource, /const BUTTON_HOVER_SCALE = 1\.045/);
  assert.match(videoSource, /hoverRef\.current\[index\] \? BUTTON_HOVER_SCALE : 1/);
  assert.doesNotMatch(videoSource, /current \+ \(target - current\) \* 0\.2/);
});

test("video DOM chrome and WebGL geometry share the source responsive breakpoint", () => {
  assert.match(videoSource, /window\.matchMedia\("\(max-width: 767px\)"\)\.matches/);
  assert.match(
    demoStylesSource,
    /@media \(max-width: 767px\) \{[\s\S]*\.dg-video-demo \{ padding: 0 12px 18px; \}[\s\S]*\.dg-video-player__button--large \{ width: 83\.25px; height: 83\.25px; \}[\s\S]*\.dg-video-player__button--small \{ width: 48\.75px; height: 48\.75px; \}[\s\S]*\.dg-video-player__bar \{ left: 12px; right: 12px; bottom: 12px; \}/s,
  );
  for (const block of demoStylesSource.match(/@media \(max-width: 640px\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g) ?? []) {
    assert.doesNotMatch(block, /\.dg-video-player__button--large/);
  }
  assert.match(videoSource, /const resizeObserver = new ResizeObserver\(\(\) => \{[\s\S]*ensureDraw\(\)/s);
  assert.match(readFileSync(new URL("../apps/docs/src/site/ComponentExample.tsx", import.meta.url), "utf8"), /rewind: "后退 15 秒"/);
  assert.match(readFileSync(new URL("../apps/docs/src/site/ComponentExample.tsx", import.meta.url), "utf8"), /forward: "前进 15 秒"/);
  assert.match(videoSource, /onClick=\{\(\) => skip\(-15\)\}/);
  assert.match(videoSource, /onClick=\{\(\) => skip\(15\)\}/);
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


test("liquid uses the shared smooth-union compositor for its full lifecycle", () => {
  assert.doesNotMatch(packageSource, /liquid-gooey/);
  assert.doesNotMatch(liquidDemoSource, /from "liquid-gooey"/);
  assert.equal(existsSync(liquidCanvasUrl), true);
  assert.match(liquidCanvasSource, /float smoothMin\(/);
  assert.match(liquidCanvasSource, /float movingBlobSdf\(/);
  assert.match(liquidCanvasSource, /float sceneSdf\(/);
  assert.match(liquidCanvasSource, /uniform vec2 uHalfSize\[8\]/);
  assert.match(liquidCanvasSource, /uniform float uCornerRadius\[8\]/);
  assert.match(liquidCanvasSource, /uniform float uDepth/);
  assert.match(liquidCanvasSource, /uniform vec4 uDome\[8\]/);
  assert.match(liquidCanvasSource, /uniform float uDomeDepth/);
  assert.match(liquidCanvasSource, /uniform float uBrightness/);
  assert.match(liquidCanvasSource, /uniform float uGlowStrength/);
  assert.match(liquidCanvasSource, /uniform float uEdgeStrength/);
  assert.match(liquidCanvasSource, /float erfApprox\(/);
  assert.match(liquidCanvasSource, /return tanh\(1\.7724538509 \* value\)/);
  assert.match(liquidCanvasSource, /float sceneSdf\(vec2 point, float inset\)/);
  assert.match(liquidCanvasSource, /float innerDistance = sceneSdf\(point, max\(uDepth, 0\.\)\)/);
  assert.match(liquidCanvasSource, /float falloff = \.5 \* \(1\. \+ erfApprox/);
  assert.match(liquidCanvasSource, /float shadowDistance = sceneSdf\(point - vec2\(0\., uShadowOffset\), 0\.\)/);
  assert.match(liquidCanvasSource, /float shadowFalloff = \.5 \* \(1\. - erfApprox/);
  assert.doesNotMatch(liquidCanvasSource, /exp\(-max\(shadowDistance|highlightInterior/);
  assert.match(liquidCanvasSource, /float align = abs\(dot\(materialUv, light\)\)/);
  assert.match(liquidCanvasSource, /float specular = min\(1\., glow\)/);
  assert.match(liquidCanvasSource, /vec2 edgeGradient = vec2\(dFdx\(distance\), dFdy\(distance\)\)/);
  assert.match(liquidCanvasSource, /float edgeLight = pow\(clamp\(abs\(dot\(edgeGradient, light\)\) \/ max\(length\(edgeGradient\), \.001\), 0\., 1\.\), uEdgeExponent\)/);
  assert.match(liquidCanvasSource, /float contour = 1\. - smoothstep\(0\., edgeWidth \* mix\(\.48, \.65, edgeLight\), inside\)/);
  assert.match(liquidCanvasSource, /float reflection = smoothstep\(edgeWidth \* \.45, edgeWidth \* \.85, inside\)/);
  assert.match(liquidCanvasSource, /1\. - smoothstep\(edgeWidth \* \.85, edgeWidth \* 2\., inside\)/);
  assert.match(liquidCanvasSource, /float reflectionLight = smoothstep\(\.75, \.98, edgeLight\)/);
  assert.match(liquidCanvasSource, /min\(\.85, edgeGain \* 3\.2\) \* mix\(\.85, \.24, edgeLight\)/);
  assert.match(liquidCanvasSource, /refracted \*= 1\. - contour \* contourStrength/);
  assert.match(liquidCanvasSource, /float rimLight = reflection \* reflectionLight \* edgeGain/);
  assert.match(liquidCanvasSource, /refracted \+= vec3\(rimLight \* \.22\)/);
  assert.match(liquidCanvasSource, /refracted \* \(1\. - shine\)/);
  assert.doesNotMatch(liquidCanvasSource, /edgeShare/);
  assert.doesNotMatch(liquidCanvasSource, /sceneNormal|insetRim/);
  assert.equal((liquidCanvasSource.match(/= sceneSdf\(/g) ?? []).length, 3, "edge profiles reuse the existing SDF distances");
  assert.match(liquidCanvasSource, /vec3 sampleChroma\(sampler2D source, vec2 uv, vec2 displacement\)/);
  assert.match(liquidCanvasSource, /if \(uBlur <= \.001\) return sampleChroma\(uSource, uv, displacement\)/);
  assert.match(liquidCanvasSource, /if \(uBlur >= \.75\) return sampleFrost\(uv, displacement\)/);
  assert.match(liquidCanvasSource, /vec2 stepSize = vec2\(uBlur \* 1\.34\) \/ uSourceSize/);
  assert.equal((liquidCanvasSource.match(/frosted \+= sampleChroma/g) ?? []).length, 8);
  assert.match(liquidCanvasSource, /smoothstep\(\.5, \.75, uBlur\)\) : frosted/);
  const specularCompositeIndex = liquidCanvasSource.indexOf("float shine = specular * uSpecular");
  const brightnessCompositeIndex = liquidCanvasSource.indexOf("refracted = mix(refracted, brightnessTarget");
  const tintCompositeIndex = liquidCanvasSource.indexOf("refracted = mix(refracted, uTintColor");
  const contourCompositeIndex = liquidCanvasSource.indexOf("refracted *= 1. - contour * contourStrength");
  const reflectionCompositeIndex = liquidCanvasSource.indexOf("refracted += vec3(rimLight");
  assert.ok(specularCompositeIndex < contourCompositeIndex && contourCompositeIndex < reflectionCompositeIndex);
  assert.ok(reflectionCompositeIndex < brightnessCompositeIndex, "both edge profiles remain inside the shared material and coverage");
  assert.ok(specularCompositeIndex >= 0 && specularCompositeIndex < brightnessCompositeIndex);
  assert.ok(brightnessCompositeIndex < tintCompositeIndex);
  assert.match(liquidCanvasSource, /vec2 glassGradient = vec2\(0\.\)/);
  assert.match(liquidCanvasSource, /vec2 materialUv = vec2\(0\.\)/);
  assert.match(liquidCanvasSource, /displacement \*= coverage \* uZoom/);
  assert.match(liquidCanvasSource, /glassGradient \* \(uRefraction \* \.5 \* falloff\)/);
  assert.doesNotMatch(liquidCanvasSource, /centerUv \+ \(uv - centerUv\) \/ max\(uZoom/);
  assert.match(liquidCanvasSource, /computeDomeConstants/);
  assert.match(liquidCanvasSource, /vec3 sampleGlass\(/);
  assert.match(liquidCanvasSource, /uRefraction/);
  assert.match(liquidCanvasSource, /uChroma/);
  assert.match(liquidCanvasSource, /uSpecular/);
  assert.match(liquidCanvasSource, /uBlur/);
  assert.match(liquidCanvasSource, /uTint/);
  assert.match(liquidCanvasSource, /uZoom/);
  assert.match(liquidCanvasSource, /uShadow/);
  assert.match(liquidCanvasSource, /mergeDistance\?: MotionInput/);
  assert.match(liquidCanvasSource, /edgeDepth\?: MotionInput/);
  assert.match(liquidCanvasSource, /blurStrength\?: MotionInput/);
  assert.match(liquidCanvasSource, /tintStrength\?: MotionInput/);
  assert.match(liquidCanvasSource, /magnification\?: MotionInput/);
  assert.match(liquidCanvasSource, /domeDepth\?: number/);
  assert.match(liquidCanvasSource, /brightness\?: number/);
  assert.match(liquidCanvasSource, /vec2 deformed = direction \* along \+ tangent \* across/);
  assert.doesNotMatch(liquidCanvasSource, /vec2 deformed = vec2\(\s*dot\(delta, direction\)/s);
  assert.doesNotMatch(liquidCanvasSource, /uTrail|movingTrail|tailBlob/i);
  assert.match(libraryIndexSource, /LiquidGlassCanvas/);
  assert.match(libraryIndexSource, /LiquidGlassBlob/);
});

test("liquid menu keeps one core-compatible Canvas material over the shared backdrop", () => {
  assert.doesNotMatch(liquidDemoSource, /buildQrGeometry|QR_SIZE|QR_GEOMETRY|occupancy|MENU_ACTIONS/);
  assert.match(liquidDemoSource, /import type \{ LensParams \} from "\.\.\/types"/);
  assert.match(liquidDemoSource, /import \{ LiquidGlassCanvas \} from "\.\.\/liquid-glass\/LiquidGlassCanvas"/);
  assert.doesNotMatch(liquidDemoSource, /<Glass|coreOpacity|fusionOpacity/);
  assert.match(liquidDemoSource, /const BASE_MENU_LENS = LIQUID_LENS/);
  assert.match(liquidDemoSource, /const LIGHT_MENU_LENS: Partial<LensParams>/);
  assert.match(liquidDemoSource, /const DARK_MENU_LENS: Partial<LensParams>/);
  assert.equal(LIQUID_GLASS_MATERIAL.chromaAmount, .55);
  assert.equal(LIQUID_GLASS_MATERIAL.refractionStrength, .11);
  assert.equal(LIQUID_GLASS_MATERIAL.specularStrength, .72);
  assert.equal(LIQUID_GLASS_MATERIAL.glowSpread, .72);
  assert.equal(LIQUID_GLASS_MATERIAL.glowStrength, .3);
  assert.equal(LIQUID_GLASS_MATERIAL.edgeWidth, 1.6);
  assert.equal(LIQUID_GLASS_MATERIAL.specularRotation, 90);
  assert.equal(LIQUID_GLASS_MATERIAL.edgeStrength, .36);
  assert.match(liquidDemoSource, /edgeStrength: 0\.42/);
  assert.match(liquidDemoSource, /const MIN_LENS_HALF = 1/);
  assert.doesNotMatch(liquidDemoSource, /BUTTON_MAP_SIZE|buttonLens/);
  assert.match(liquidDemoSource, /const halfWidth = useMotionValue\(MIN_LENS_HALF\)/);
  assert.match(liquidDemoSource, /const halfHeight = useMotionValue\(MIN_LENS_HALF\)/);
  assert.match(liquidDemoSource, /const cornerRadius = useMotionValue\(MIN_LENS_HALF\)/);
  assert.match(liquidDemoSource, /const buttonHalf = useMotionValue\(TRIGGER_RADIUS\)/);
  assert.match(liquidDemoSource, /const buttonCenterX = useMotionValue\(0\.5\)/);
  assert.match(liquidDemoSource, /const buttonCenterY = useMotionValue\(0\.5\)/);
  assert.match(liquidDemoSource, /x: buttonCenterX,[\s\S]*y: buttonCenterY,[\s\S]*velocityX: rawButtonVelocityX/s);
  assert.doesNotMatch(liquidDemoSource, /const lensHalfWidth = useTransform/);
  assert.match(liquidDemoSource, /const triggerCenterX = clamp\(panelRight - 38/);
  assert.match(liquidDemoSource, /const triggerCenterY = clamp\(panelBottom - 38/);
  assert.match(liquidDemoSource, /const OPEN_MORPH_DURATION = 0\.38/);
  assert.match(liquidDemoSource, /const OPEN_CONTENT_DURATION = 0\.34/);
  assert.match(liquidDemoSource, /const CLOSE_CONTENT_DURATION = 0\.24/);
  assert.match(liquidDemoSource, /const OPEN_MORPH_EASES = \[[\s\S]*cubicBezier/s);
  assert.match(liquidDemoSource, /const CLOSE_FUSION_DURATION = 0\.38/);
  assert.doesNotMatch(liquidDemoSource, /SHADOW_SETTLE|SHADOW_HANDOFF|HIGHLIGHT_SETTLE/);
  assert.match(liquidDemoSource, /const CLOSE_IMPACT_DISTANCE = 2/);
  assert.match(liquidDemoSource, /function closeImpactVector\(layout: MenuLayout\)/);
  assert.match(liquidDemoSource, /Math\.hypot\(dx, dy\)/);
  assert.match(liquidDemoSource, /const CLOSE_FUSION_EASES = \[[\s\S]*cubicBezier/s);
  assert.match(liquidDemoSource, /cubicBezier\(0\.42, 0, 0\.58, 1\)/);
  assert.match(liquidDemoSource, /cubicBezier\(0\.35, 0, 0\.7, 0\.7\)/);
  assert.match(liquidDemoSource, /cubicBezier\(0\.16, 0, 0\.18, 1\)/);
  assert.match(liquidDemoSource, /function closeContactCenter\(/);
  assert.match(liquidDemoSource, /morph\(halfWidth, widthFrames, true\)/);
  assert.match(liquidDemoSource, /morph\(halfHeight, heightFrames, true\)/);
  assert.match(liquidDemoSource, /ease: liquidEasings\(values, times, duration, velocity\)/);
  assert.match(liquidDemoSource, /const interrupted = transitioningRef\.current/);
  assert.match(liquidDemoSource, /retargetLiquidFrames\(value\.get\(\), keyframes\[keyframes\.length - 1\], duration, velocity\)/);
  assert.match(liquidDemoSource, /animate\(triggerOpacity, interrupted \? \[triggerOpacity\.get\(\), 1\] : \[triggerOpacity\.get\(\), 0, 0\.2, 0\.94, 1, 1\]/);
  assert.match(liquidDemoSource, /const impact = closeImpactVector\(layout\)/);
  assert.match(liquidDemoSource, /const approachCenter = closeContactCenter\(\s*layout,\s*widthFrames\[2\],\s*heightFrames\[2\],\s*buttonFrames\[2\],\s*21,/s);
  assert.match(liquidDemoSource, /const contactCenter = closeContactCenter\(\s*layout,\s*widthFrames\[3\],\s*heightFrames\[3\],\s*buttonFrames\[3\],\s*-8,/s);
  assert.match(liquidDemoSource, /const triggerOffsetX = useTransform\(buttonCenterX/);
  assert.match(liquidDemoSource, /const triggerOffsetY = useTransform\(buttonCenterY/);
  assert.match(liquidDemoSource, /const transitioningRef = useRef\(false\)/);
  assert.match(liquidDemoSource, /const fusionBlobs = useMemo\(/);
  assert.match(liquidDemoSource, /const materialProgress = useTransform\(halfWidth/);
  assert.match(liquidDemoSource, /const materialBlur = useTransform\(materialProgress, \(progress\) => 0\.5 \+ progress \* 1\.1\)/);
  assert.match(liquidDemoSource, /const materialDepth = useTransform\(\[materialProgress, depth, buttonDepth\], blendMaterialValue\)/);
  assert.match(liquidDemoSource, /\[materialProgress, tintOpacity, buttonTintOpacity\],[\s\S]*blendMaterialValue/s);
  assert.match(liquidDemoSource, /const materialZoom = useTransform\(\[materialProgress, zoom, buttonZoom\], blendMaterialValue\)/);
  assert.doesNotMatch(liquidDemoSource, /morph\(triggerOffset[XY]/);
  assert.match(liquidDemoSource, /const finishTransition = \(\) => \{/);
  assert.match(liquidDemoSource, /transitioningRef\.current = false/);
  assert.match(liquidDemoSource, /Promise\.all\(animations\.current\)\.then\(finishTransition\)/);
  assert.doesNotMatch(liquidDemoSource, /Handoff|handoff|coreOpacity|fusionOpacity|stableShadow|stableSpecular/);
  assert.match(liquidDemoSource, /if \(!interrupted\) \{\s*const startHalf = buttonHalf\.get\(\);/);
  assert.match(liquidDemoSource, /morph\(buttonHalf, buttonFrames, true\)/);
  assert.match(liquidDemoSource, /morph\(mergeDistance, \[mergeDistance\.get\(\), 0, 40, 28, 2, 0\]/);
  assert.match(liquidDemoSource, /\(layout\.triggerCenterX \+ impact\.x\) \/ size\.width/);
  assert.match(liquidDemoSource, /\(layout\.triggerCenterY \+ impact\.y\) \/ size\.height/);
  assert.match(liquidDemoSource, /Math\.max\(0, buttonHalf\.getVelocity\(\)\) \* 0\.9/);
  assert.match(liquidDemoSource, /openRef\.current && buttonHalf\.get\(\) <= MIN_LENS_HALF/);
  assert.doesNotMatch(liquidDemoSource, /tintBlur|buttonTintBlur/);
  assert.doesNotMatch(liquidDemoSource, /animate\((menu|button)Velocity[XY],/);
  assert.match(liquidDemoSource, /rightEdge\.getVelocity\(\) - halfWidth\.getVelocity\(\)/);
  assert.match(liquidDemoSource, /frame\.preRender\(updateVelocity\)/);
  assert.doesNotMatch(liquidDemoSource, /direction\.[xy] \* 780/);
  assert.match(liquidDemoSource, /x: triggerOffsetX,[\s\S]*y: triggerOffsetY,/s);
  assert.match(liquidDemoSource, /const pressHalf = pressed \? TRIGGER_RADIUS \* 1\.025 : TRIGGER_RADIUS/);
  assert.match(liquidDemoSource, /if \(openRef\.current \|\| transitioningRef\.current\) return/);
  assert.match(liquidDemoSource, /animate\(buttonHalf, pressHalf/);
  assert.match(liquidDemoSource, /if \(nextOpen\) triggerRef\.current\?\.blur\(\)/);
  assert.match(liquidDemoSource, /focusDelay = reduceMotion[\s\S]*transitionDuration \* 1000 \+ 32/s);
  assert.match(liquidDemoSource, /if \(reduceMotion\)[\s\S]*halfWidth\.jump\(target\.halfWidth\)/s);
  assert.equal((liquidDemoSource.match(/<LiquidGlassCanvas/g) ?? []).length, 1);
  assert.match(liquidDemoSource, /<LiquidGlassCanvas[\s\S]*sourceRef=\{fusionSourceRef\}[\s\S]*blobs=\{fusionBlobs\}[\s\S]*mergeDistance=\{rawMergeDistance\}/s);
  assert.match(liquidDemoSource, /edgeDepth=\{materialDepth\}/);
  assert.match(liquidDemoSource, /blurStrength=\{materialBlur\}/);
  assert.match(liquidDemoSource, /tintStrength=\{materialTintOpacity\}/);
  assert.match(liquidDemoSource, /magnification=\{materialZoom\}/);
  assert.match(liquidDemoSource, /specularRotation=\{menuLens\.specularRotation\}/);
  assert.match(liquidDemoSource, /glowStrength=\{menuLens\.glowStrength\}/);
  assert.match(liquidDemoSource, /edgeStrength=\{menuLens\.edgeStrength\}/);
  assert.match(liquidDemoSource, /specularStrength=\{menuLens\.specularStrength\}/);
  assert.match(liquidDemoSource, /domeDepth=\{menuLens\.domeDepth\}/);
  assert.match(liquidDemoSource, /brightness=\{menuLens\.brightness\}/);
  assert.match(liquidDemoSource, /refractionStrength=\{menuLens\.scaleX\}/);
  assert.match(liquidDemoSource, /chromaAmount=\{menuLens\.chromaAmount\}/);
  assert.match(liquidDemoSource, /shadowStrength=\{0\.11\}/);
  assert.match(liquidDemoSource, /<div className="dg-liquid-menu__fusion-layer" aria-hidden="true">/);
  assert.match(liquidDemoSource, /className="dg-liquid-menu__fusion-source"/);
  assert.doesNotMatch(liquidDemoSource, /overlay=|opticalOpacity|dg-liquid-menu__optical/);
  assert.match(liquidDemoSource, /const contentPose = useTransform\([\s\S]*liquidContentPose\(values as number\[\]/s);
  assert.match(liquidDemoSource, /transform: contentTransform,\s*transformOrigin: "0 0"/);
  assert.match(liquidDemoSource, /const contentFilter = useTransform\(contentBlur/);
  assert.match(liquidDemoSource, /const contentClip = useTransform\(/);
  assert.match(liquidDemoSource, /clipPath: contentClip/);
  assert.match(liquidDemoSource, /animate\(reveal, \[reveal\.get\(\), reveal\.get\(\), Math\.max\(reveal\.get\(\), 0\.94\), 1\]/);
  assert.match(liquidDemoSource, /duration: OPEN_CONTENT_DURATION,[\s\S]*times: \[0, 0\.06, 0\.62, 1\]/s);
  assert.match(liquidDemoSource, /animate\(reveal, \[reveal\.get\(\), reveal\.get\(\) \* 0\.3, reveal\.get\(\) \* 0\.02, 0\], \{[\s\S]*duration: CLOSE_CONTENT_DURATION \* transitionDuration \/ CLOSE_FUSION_DURATION,[\s\S]*times: \[0, 0\.28, 0\.52, 1\]/s);
  assert.doesNotMatch(liquidDemoSource, /ease:\s*"linear"|type:\s*"spring"/);
  assert.match(liquidDemoSource, /tintColor=\{theme === "dark" \? \[74 \/ 255, 74 \/ 255, 70 \/ 255\] : \[1, 1, 1\]\}/);
  assert.match(liquidDemoSource, /tint: 0\.035/);
  assert.match(liquidDemoSource, /zoom: 1\.38/);
  assert.match(liquidDemoSource, /aria-expanded=\{open\}/);
  assert.match(liquidDemoSource, /pointerEvents: open \? "none" : "auto"/);
  assert.match(liquidDemoSource, /role="menu"/);
  assert.match(liquidDemoSource, /event\.key !== "Escape"/);
  assert.match(liquidDemoSource, /window\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(liquidDemoSource, /createLiquidBackdrop\(owner/);
  assert.doesNotMatch(demoStylesSource, /--dg-liquid-grid/);
  assert.doesNotMatch(demoStylesSource, /dg-liquid-menu__grid|dg-liquid-menu__core-layer/);
  assert.match(demoStylesSource, /\.dg-liquid-menu__fusion-layer \{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__fusion-canvas \{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__fusion-source \{ display: none; \}/);
  assert.doesNotMatch(demoStylesSource, /dg-liquid-menu__optical/);
  assert.match(demoStylesSource, /\.dg-liquid-menu__panel[^}]*overflow:\s*hidden/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__scroll[^}]*overflow-y:\s*auto/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__scroll \{[\s\S]*?padding:\s*14px;/s);
  assert.match(demoStylesSource, /\.dg-liquid-glass \{[\s\S]*?--dg-liquid-menu-radius:\s*44px;[\s\S]*?--dg-liquid-item-radius:\s*31px;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__sort-row,[\s\S]*?\.dg-liquid-menu__filter-row \{[\s\S]*?border-radius:\s*var\(--dg-liquid-item-radius\);/s);
  assert.match(demoStylesSource, /\.dg-liquid-glass,[\s\S]*?\.dg-liquid-menu__panel,[\s\S]*?\.dg-liquid-menu__scroll::.*scrollbar-thumb[\s\S]*?corner-shape:\s*squircle;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__sort-row,[\s\S]*?\.dg-liquid-menu__filter-row \{[\s\S]*?corner-shape:\s*round;/s);
  assert.doesNotMatch(demoStylesSource, /\.dg-liquid-menu__glass \*/);
  assert.match(demoStylesSource, /\.dg-liquid-menu__trigger \{[\s\S]*?border-radius:\s*50%;[\s\S]*?corner-shape:\s*round;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__sort-row \{[\s\S]*?height:\s*64px;[\s\S]*?min-height:\s*64px;/s);
  assert.doesNotMatch(demoStylesSource, /\.dg-liquid-menu__sort-row\[data-selected="true"\][^{]*\{[^}]*height/s);
  assert.match(demoStylesSource, /@media \(max-width: 640px\)[\s\S]*?\.dg-liquid-menu__scroll \{ padding: 10px; \}/s);
  assert.match(demoStylesSource, /@media \(max-width: 640px\)[\s\S]*?\.dg-liquid-glass \{[\s\S]*?--dg-liquid-menu-radius: 40px;[\s\S]*?--dg-liquid-item-radius: 30px;[\s\S]*?\}/s);
  assert.doesNotMatch(demoStylesSource, /\.dg-liquid-menu__panel::after/);
  assert.doesNotMatch(liquidDemoSource, /OPEN_WIDTH_SPRING|OPEN_HEIGHT_SPRING|deformation|renderedHalf/);
  assert.doesNotMatch(liquidDemoSource, /dragConstraints|dragMomentum|onDragStart|onDragEnd|movingTrail/);
});

test("liquid content refraction and blur follow shape, with a neutral settled endpoint", () => {
  const layout = { panelWidth: 404, panelHeight: 748, panelRadius: 44 };
  assert.deepEqual(liquidContentOptics([202, 374, 44], layout), { refraction: 0, blur: 0 });
  const capsule = liquidContentOptics([190, 270, 190], layout);
  const recovering = liquidContentOptics([203, 376, 48], layout);
  assert.ok(capsule.refraction > recovering.refraction && capsule.blur > recovering.blur);
  assert.ok(recovering.refraction > 0 && recovering.blur > 0);
  for (const shape of [[1, 1, 1], [34, 34, 34], [190, 270, 190], [202, 374, 44]]) {
    const optics = liquidContentOptics(shape, layout);
    assert.ok(optics.refraction >= 0 && optics.refraction <= 1);
    assert.ok(optics.blur >= 0 && optics.blur <= 2.4);
  }
  assert.match(liquidDemoSource, /contentRevision\.set\(contentRevision\.get\(\) \+ 1\)/);
  assert.match(liquidDemoSource, /!reducedMotion && !interrupted/);
  assert.match(liquidDemoSource, /contentActive\.jump\(0\)/);
  assert.match(liquidDemoSource, /Math\.max\(contentOptics\.get\(\)\.blur, closingBlur\.get\(\)\)/);
  assert.match(liquidDemoSource, /animate\(closingBlur, 3\.2, \{ duration: 0\.08/);
  assert.match(liquidDemoSource, /animate\(closingBlur, 0, \{ duration: 0\.16/);
  assert.match(liquidDemoSource, /closingBlur\.jump\(0\)/);
  assert.match(liquidDemoSource, /opacity: domContentOpacity/);
  assert.match(liquidCanvasSource, /local - displacement \* uSourceSize \* \.42 \* uContentRefraction \* edgeFocus/);
  assert.match(liquidCanvasSource, /texture\(uContent, uv, log2\(1\. \+ uContentBlur \* 2\.\)\)/);
  assert.match(liquidCanvasSource, /gl\.LINEAR_MIPMAP_LINEAR/);
  assert.match(liquidCanvasSource, /UNPACK_PREMULTIPLY_ALPHA_WEBGL, true/);
  assert.match(liquidCanvasSource, /value\.on\("change", scheduleDraw\)/);
  assert.ok(liquidCanvasSource.indexOf("refracted = refracted * (1. - ink.a") < liquidCanvasSource.indexOf("color = mix(raw.rgb, refracted, coverage * uOpacity)"));
});

test("liquid shape trajectories stay round early, gather on close, and preserve knot velocity", () => {
  for (const [width, height, radius] of [[202, 374, 44], [159, 345, 40]]) {
    const opening = [openWidthFrames(34, width), openHeightFrames(34, height), openRadiusFrames(34, radius, width, height)];
    assert.equal(opening[2][2], Math.min(opening[0][2], opening[1][2]), "early body is a capsule, not a miniature panel");
    assert.ok(opening[0][2] / width > opening[1][2] / height, "width develops before height");
    assert.ok(OPEN_MORPH_TIMES[2] < 0.3 && opening[1][2] / height >= 0.7, "main expansion is early, leaving time for contour recovery");
    const closing = [closeMenuWidthFrames(width), closeMenuHeightFrames(height), closeMenuRadiusFrames(radius, width, height), closeButtonFrames(1)];
    assert.ok(closing[2][1] > radius && closing[0][1] < width, "closure rounds and bunches before travel");
    assert.deepEqual(closing.map((track) => track.at(-1)), [1, 1, 1, 34], "the panel is absorbed into the returning button");
    assert.ok(closing[0][2] > closing[3][2] * 3 && closing[2][2] > closing[0][2] * 0.95, "a small anchored head draws the gathered, rounded body");
    assert.ok(closing[3][3] >= 32 && closing[0][3] >= 30 && closing[1][3] > closing[0][3], "the button is established while a trailing lobe still remains");
    assert.ok(CLOSE_FUSION_TIMES[2] >= 0.45 && CLOSE_FUSION_TIMES[3] >= 0.68, "neck and two-lobed absorption remain legible in the second half");
    assert.ok(closing[0][4] < closing[3][4] && closing[3][4] === 34.6, "absorbing the panel gives the button one restrained impact");
    for (const [tracks, times, duration] of [[opening, OPEN_MORPH_TIMES, 0.38], [closing, CLOSE_FUSION_TIMES, 0.38]]) {
      for (const values of tracks) {
        const eases = liquidEasings(values, times, duration);
        const epsilon = 1e-6;
        const slope = (segment, end) => {
          const ease = eases[segment];
          const derivative = end ? (ease(1) - ease(1 - epsilon)) / epsilon : (ease(epsilon) - ease(0)) / epsilon;
          return derivative * (values[segment + 1] - values[segment]) / (times[segment + 1] - times[segment]) / duration;
        };
        assert.ok(Math.abs(slope(0, false)) < 0.1);
        assert.ok(Math.abs(slope(eases.length - 1, true)) < 0.1);
        for (let index = 0; index < eases.length; index += 1) {
          assert.equal(eases[index](0), 0);
          assert.equal(eases[index](1), 1);
          for (let frame = 0; frame <= 120; frame += 1) {
            const amount = eases[index](frame / 120);
            assert.ok(amount >= -1e-8 && amount <= 1 + 1e-8, "no hidden extra bounce between poses");
          }
          if (index > 0) assert.ok(Math.abs(slope(index - 1, true) - slope(index, false)) < 0.1, "no velocity discontinuity at a knot");
        }
      }
    }
  }
  const reversed = liquidEasings([120, 1], [0, 1], 0.42, 600)[0];
  const initialVelocity = (reversed(1e-6) - reversed(0)) * (1 - 120) / 1e-6 / 0.42;
  assert.ok(Math.abs(initialVelocity - 600) < 0.01, "retarget carries live velocity before changing direction");
  for (const [start, target, velocity] of [[130, 34, 2400], [100, 202, -1600]]) {
    const { values, times } = retargetLiquidFrames(start, target, 0.42, velocity);
    const ease = liquidEasings(values, times, 0.42, velocity)[0];
    const brakeDuration = times[1] * 0.42;
    assert.equal(brakeDuration, 0.04);
    assert.equal(values[1], start + velocity * 0.02, "outgoing momentum has a bounded stopping distance");
    const initial = ease(1e-6) * (values[1] - start) / 1e-6 / brakeDuration;
    const final = (1 - ease(1 - 1e-6)) * (values[1] - start) / 1e-6 / brakeDuration;
    assert.ok(Math.abs(initial - velocity) < 0.01, "braking never resets the live velocity");
    assert.ok(Math.abs(final) < 0.01, "the shape comes to rest before reversing");
  }
  const toward = retargetLiquidFrames(130, 202, 0.38, 4000);
  const towardEases = liquidEasings(toward.values, toward.times, 0.38, 4000);
  for (const [index, ease] of towardEases.entries()) {
    for (let step = 0; step <= 100; step += 1) {
      const value = toward.values[index] + (toward.values[index + 1] - toward.values[index]) * ease(step / 100);
      assert.ok(value >= 130 && value <= 202, "repeated retargeting cannot throw fast travel past the new destination");
    }
  }
});

test("interrupted Liquid closes scale one bounded clock with the live body", () => {
  const durationCode = liquidDemoSource.match(/const transitionDuration = nextOpen[\s\S]*?;/)?.[0];
  assert.ok(durationCode);
  const duration = new Function("nextOpen", "interrupted", "halfWidth", "halfHeight", "layout", "clamp",
    `const OPEN_MORPH_DURATION = .38, CLOSE_FUSION_DURATION = .38; ${durationCode}\nreturn transitionDuration;`);
  const layout = { panelWidth: 404, panelHeight: 748 };
  const clock = (widthProgress, heightProgress, interrupted = true, open = false) => duration(
    open, interrupted, { get: () => 202 * widthProgress }, { get: () => 374 * heightProgress }, layout,
    (value, min, max) => Math.min(max, Math.max(min, value)),
  );
  assert.ok(Math.abs(clock(.15, .1) - .209) < 1e-9, "small interrupted bodies return without a full-panel wait");
  assert.ok(Math.abs(clock(.7, .6) - .266) < 1e-9);
  assert.ok(Math.abs(clock(.4, .8) - .304) < 1e-9, "both size axes participate in the shared return duration");
  assert.equal(clock(1.02, 1.01), .38, "opening overshoot must not lengthen the close");
  assert.equal(clock(.15, .1, false), .38, "ordinary close keeps its complete fusion/impact trajectory");
  assert.equal(clock(.15, .1, true, true), .38, "opening timing is unchanged");
  assert.match(liquidDemoSource, /const duration = transitionDuration/);
  assert.doesNotMatch(liquidDemoSource, /duration: CLOSE_FUSION_DURATION/);
  assert.match(liquidDemoSource, /duration: CLOSE_CONTENT_DURATION \* transitionDuration \/ CLOSE_FUSION_DURATION/);
  assert.match(liquidDemoSource, /transitionDuration \* 1000 \+ 32/);
  for (const seconds of [.209, .266, .304, .38]) {
    const { values, times } = retargetLiquidFrames(70, 1, seconds, 1200);
    const eases = liquidEasings(values, times, seconds, 1200);
    assert.ok(Math.abs(times[1] * seconds - .04) < 1e-9, "shortening the return must retain the bounded momentum brake");
    for (let i = 0; i < eases.length; i++) for (let frame = 0; frame <= 120; frame++) {
      const value = values[i] + (values[i + 1] - values[i]) * eases[i](frame / 120);
      assert.ok(Number.isFinite(value) && value >= 1 - 1e-9 && value <= 94 + 1e-9, "no overshoot beyond the braking distance or negative lens size");
    }
  }
});

test("liquid contents share the moving SDF's center, directional stretch, and rounded clip", () => {
  const layout = { panelLeft: 258, panelTop: 66, panelWidth: 404, panelHeight: 748 };
  const rest = liquidContentPose([662, 814, 202, 374, 44, 0, 0], layout);
  assert.equal(rest.transform, "matrix(1, 0, 0, 1, 0, 0)");
  assert.equal(rest.clipPath, "inset(0 round 44px / 44px)");
  for (const [vx, vy] of [[0, 0], [180, 0], [0, -180], [-80, -160], [1700, 900]]) {
    const hw = 130, hh = 220, radius = 110, right = 640, bottom = 780;
    const pose = liquidContentPose([right, bottom, hw, hh, radius, vx, vy], layout);
    const [a, b, c, d, tx, ty] = pose.transform.slice(7, -1).split(",").map(Number);
    const map = (x, y) => [a * x + c * y + tx + layout.panelLeft, b * x + d * y + ty + layout.panelTop];
    const center = map(layout.panelWidth / 2, layout.panelHeight / 2);
    assert.ok(Math.abs(center[0] - (right - hw)) < 1e-8);
    assert.ok(Math.abs(center[1] - (bottom - hh)) < 1e-8);
    const speed = Math.hypot(vx, vy), amount = Math.min(speed / 1100, 1);
    const dx = amount > 0.001 ? vx / speed : 1, dy = amount > 0.001 ? vy / speed : 0;
    const stretch = 1 + amount * 0.52, squash = 1 / Math.sqrt(stretch);
    // A rounded corner from the CSS clip must land exactly on the shader's zero contour.
    const local = [hw - radius + radius / Math.SQRT2, hh - radius + radius / Math.SQRT2];
    const world = map((local[0] + hw) * layout.panelWidth / (2 * hw), (local[1] + hh) * layout.panelHeight / (2 * hh));
    const delta = [world[0] - center[0], world[1] - center[1]];
    const along = (delta[0] * dx + delta[1] * dy) / stretch;
    const across = (-delta[0] * dy + delta[1] * dx) / squash;
    const edge = [Math.abs(dx * along - dy * across) - (hw - radius), Math.abs(dy * along + dx * across) - (hh - radius)];
    assert.ok(Math.abs(Math.hypot(...edge) - radius) < 1e-8, "content cannot slide through the glass edge");
    assert.equal(pose.clipPath, `inset(0 round ${radius / (2 * hw / layout.panelWidth)}px / ${radius / (2 * hh / layout.panelHeight)}px)`);
  }
});

test("switch and slider expose a small size without changing default geometry", () => {
  assert.equal((componentSource.match(/size\?: "default" \| "small"/g) ?? []).length, 2);
  assert.match(componentSource, /const width = compact \? 52 : 74/);
  assert.match(componentSource, /const height = compact \? 20 : 28/);
  assert.match(componentSource, /const width = compact \? 120 : 240/);
  assert.match(componentSource, /const thumbHeight = compact \? 16 : 22/);
  assert.match(componentSource, /const trackHeight = compact \? 4 : 6/);
});

test("dark switch uses its own neutral enabled color", () => {
  assert.match(libraryStylesSource, /html\[data-theme="dark"\] \.dg-switch\s*\{\s*--dg-switch-on:\s*#777773/);
  assert.match(libraryStylesSource, /var\(--dg-switch-on, var\(--dg-control-accent\)\)/);
});

test("action glass stays icon-free and uses a neutral dark material", () => {
  assert.doesNotMatch(additionalDemosSource, /Sparkles|<svg/);
  assert.match(additionalDemosSource, /tintColor="var\(--action-glass-tint, var\(--dg-action-tint\)\)"/);
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
  assert.match(componentSource, /duration: 0\.6/);
  assert.match(componentSource, /return Math\.min\(0\.18, speed \*\* 0\.62 \* 0\.0045\)/);
  assert.match(componentSource, /zoom=\{zoom\}/);
  assert.match(componentSource, /depth=\{boostedDepth\}/);
  assert.match(componentSource, /refracted \? color1 : "#bcbbbb"/);
});




test("segmented control supports pointer press-drag tab switching", () => {
  assert.match(componentSource, /event\.pointerType === "mouse"/);
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
  assert.match(componentSource, /width \* \(1 \+ amount \* 0\.75\)/);
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
  assert.match(componentSource, /releaseInteraction\(0, dragMoved\.current\)/);
  assert.match(componentSource, /const releaseInteraction = \(delay = 0, settle = true\)/);
  assert.match(componentSource, /const travel = settle \? updateGeometry\(selectedRef\.current, false\) : travelSettled\.current/);
  assert.match(componentSource, /width \* \(1 \+ amount \* 0\.10\)/);
  assert.match(componentSource, /height \* \(1 \+ amount \* 0\.22\)/);
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
  assert.match(componentSource, /const SEGMENTED_TRAVEL_SPRING = \{ mass: 1, stiffness: 260, damping: 28 \}/);
  assert.match(componentSource, /const SEGMENTED_PRESS_SPRING = \{ mass: 0\.9, stiffness: 320, damping: 28 \}/);
  assert.match(componentSource, /const SEGMENTED_RELEASE_SPRING = \{ mass: 1, stiffness: 150, damping: 19 \}/);
  assert.match(componentSource, /velocity: value\.getVelocity\(\)/);
  assert.match(componentSource, /const x = useMotionValue\(0\.5\)/);
  assert.match(componentSource, /springTo\(interaction, 1, SEGMENTED_PRESS_SPRING\)/);
  assert.match(componentSource, /springTo\(interaction, 0, SEGMENTED_RELEASE_SPRING\)/);
  assert.doesNotMatch(componentSource, /let velocity = 0;[\s\S]*velocity \+= \(stiffness/);
});

test("segmented glass attenuation overlaps the low-amplitude travel tail", () => {
  assert.match(componentSource, /const glassOpacity = useMotionValue\(0\)/);
  assert.doesNotMatch(componentSource, /Promise\.all\(\[shape\.finished, height\.finished\]\)/);
  assert.match(componentSource, /waitForRest\(\[renderedLensW, renderedLensH, impactX, deformation, interaction, glassHeight\]/);
  assert.match(componentSource, /epsilon = 1, timeoutMs = 900, holdMs = 32/);
  assert.match(componentSource, /restTimer = window\.setTimeout\(finish, holdMs\)/);
  assert.match(componentSource, /animate\(glassOpacity, 0, \{ duration: 0\.12, ease: \[0\.22, 1, 0\.36, 1\] \}\)/);
  assert.doesNotMatch(componentSource, /setTimeout\(\(\) => \{\s*rootRef\.current\?\.removeAttribute\("data-interacting"\)/);
  assert.doesNotMatch(libraryStylesSource, /\.dg-tabs__solid-thumb\s*\{[^}]*opacity 90ms/s);
});

test("the optical exit requires sustained geometric rest, not one zero crossing", async () => {
  let now = 0, id = 0;
  const timers = new Map();
  const clock = {
    setTimeout(fn, ms) { timers.set(++id, { fn, at: now + ms }); return id; },
    clearTimeout(key) { timers.delete(key); },
  };
  const tick = ms => {
    now += ms;
    for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.fn(); }
  };
  const source = componentSource.slice(componentSource.indexOf("function waitForRest("), componentSource.indexOf("export function useDerivedMotion("));
  const wait = new Function("window", `${stripTypeScriptTypes(source)}; return waitForRest;`)(clock);
  const geometry = motionValue(5);
  let ended = false;
  const pending = wait([geometry], () => Math.abs(geometry.get())).then(() => { ended = true; });
  geometry.set(.2); tick(20); geometry.set(-3); tick(40);
  await Promise.resolve(); assert.equal(ended, false, "the recoil must reset the stable window");
  geometry.set(.2); tick(31); await Promise.resolve(); assert.equal(ended, false);
  tick(1); await pending; assert.equal(timers.size, 0);
});

test("the retained material supports opaque control rests without covering refracted ink", () => {
  assert.match(liquidAdapterSource, /base \+ \(1 - base\) \* Math\.max\(0, Math\.min\(1, readMotion\(props\.tintOpacity \?\? 0\)\)\)/);
  assert.match(liquidAdapterSource, /ref=\{contentRef\} style=\{\{ position: "relative", zIndex: 0 \}\}/);
  assert.equal((componentSource.match(/const tintOpacity = useMotionValue\(1\)/g) ?? []).length, 1, "Switch and Slider share one thumb material controller");
  assert.equal((componentSource.match(/= useThumbMotion\(/g) ?? []).length, 2);
  assert.match(additionalDemosSource, /const tintStrength = useMotionValue\(0\.1846\)/, "the approved action tint is not made opaque with the controls");
});

test("segmented braking squashes both axes and hover stays subtle", () => {
  assert.match(componentSource, /stiffness: \(\) => impactLanded\.current && stationaryPress\(\) \? SEGMENTED_HOLD_IMPACT_SCRIPT\.stiffness : 210/);
  assert.match(componentSource, /if \(!impactLanded\.current\) return 26/);
  assert.match(componentSource, /return 30/);
  assert.match(componentSource, /typeof options\.stiffness === "function" \? options\.stiffness\(\) : options\.stiffness/);
  assert.match(componentSource, /typeof options\.damping === "function" \? options\.damping\(\) : options\.damping/);
  assert.match(componentSource, /width \* \(1 \+ amount \* 0\.75\)/);
  assert.match(componentSource, /height \* \(1 - amount \* 0\.52\)/);
  assert.match(libraryStylesSource, /\.dg-tabs__item:not\(\[data-selected\]\):hover\s*\{\s*background:\s*rgba\(18, 18, 22, \.035\)/s);
});

test("segmented arrival pins most velocity stretch behind the leading edge", () => {
  assert.match(componentSource, /const SEGMENTED_IMPACT_RETENTION = 0\.18/);
  assert.match(componentSource, /const SEGMENTED_TRAIL_BIAS = 0\.35/);
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
  assert.match(componentSource, /const SEGMENTED_HOLD_IMPACT_SCRIPT = \{\s*stiffness: 360,\s*damping: 24,\s*impulse: -1\.6,\s*\} as const/s);
  assert.match(componentSource, /const velocityImpulseRef = useRef\(0\)/);
  assert.match(componentSource, /velocity \+= velocityImpulseRef\.current/);
  assert.match(componentSource, /velocityImpulseRef\.current = 0/);
  assert.match(componentSource, /if \(!impactLanded\.current && \(x\.get\(\) - impactTargetX\.current\) \* direction >= 0\)/);
  assert.match(componentSource, /impactKickRef\.current\(SEGMENTED_HOLD_IMPACT_SCRIPT\.impulse\)/);
});

test("segmented glass stays slightly taller than the tab group", () => {
  assert.match(componentSource, /const glassHeight = useMotionValue\(0\)/);
  assert.match(componentSource, /const heightBoost = useDerivedMotion2\(glassHeight, deformation, \(active, amount\) =>\s*active \* \(0\.18 - Math\.min\(0\.10, Math\.max\(0, amount\) \* 0\.55\)\)\)/s);
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
  assert.match(libraryStylesSource, /\.dg-tabs > \.dg-tabs__group > \.dg-tabs__item\[data-selected\][^}]*color:\s*var\(--dg-control-text\)/s);
  assert.match(libraryStylesSource, /\.dg-tabs\[data-crossfading\] \.dg-tabs__group--glass-base \.dg-tabs__item\[data-selected\]/);
});

test("segmented final state attenuates optics over an already-present base material", () => {
  assert.match(componentSource, /animate\(solidOpacity, 0, \{ duration: 0\.1/);
  assert.match(componentSource, /solidOpacity\.set\(1\);\s*rootRef\.current\?\.setAttribute\("data-crossfading", ""\)/);
  assert.doesNotMatch(componentSource, /animate\(solidOpacity, 1/);
});

test("video demo refracts one live texture through the shared four-blob material", () => {
  assert.match(videoSource, /createLiquidGlassRenderer\(canvas/);
  assert.match(videoSource, /Array\.from\(\{ length: 4 \}/);
  assert.match(videoSource, /source: video, sourceRevision, width, height, blobs/);
  assert.match(videoSource, /playSize = 111/);
  assert.match(videoSource, /sideSize = 65/);
  assert.match(videoSource, /blobs\[3\]\.halfWidth = barWidth \/ 2/);
  assert.doesNotMatch(videoSource, /backdrop-filter|FRAGMENT_SHADER/);
  assert.match(videoSource, /\.svg\?raw/);
});






test("runtime styling uses the project-owned namespace and private references stay ignored", () => {
  const runtimeSource = [componentSource, heroSource, videoSource, liquidDemoSource, liquidCanvasSource, libraryStylesSource, demoStylesSource].join("\n");
  assert.match(runtimeSource, /dg-(?:control|switch|slider|tabs|hero|qr|video)/);
  assert.match(filterSource, /data-dg-glass-surface=""/);
  assert.match(contextSource, /\[data-dg-glass-surface\]/);
  assert.match(videoSource, /\.\.\/assets\/video\/pause\.svg\?raw/);
  assert.match(gitignoreSource, /^\.openai\/$/m);
  assert.match(gitignoreSource, /^\.dezin\/$/m);
});

test("core library stays CSS-free while optional controls ship standalone styles", () => {
  assert.doesNotMatch(libraryIndexSource, /import ["']\.\/(?:style|controls)\.css["']/);
  assert.match(stylesSource, /@import "refractive-glass-react\/controls\.css"/);
  assert.equal(JSON.parse(packageSource).exports["./controls.css"].default, "./dist/controls.css");
  assert.doesNotMatch(packageSource, /"\.\/style\.css"/);
  assert.match(libraryConfigSource, /copyFileSync\(resolve\(import\.meta\.dirname, "src\/controls\.css"\), resolve\(libraryDir, "controls\.css"\)\)/);
  assert.doesNotMatch(readmeSource, /refractive-glass-react\/style\.css/);
  assert.match(readmeSource, /refractive-glass-react\/controls\.css/);
  assert.match(libraryStylesSource, /--dg-control-accent: var\(--primary, light-dark\(#262626, #dededb\)\)/);
  assert.match(libraryStylesSource, /--dg-control-track: var\(--bg-4, light-dark\(#dcdcd8, #2c2c2c\)\)/);
});





test("control optics retain size-independent pixel gain and the approved menu material", () => {
  assert.match(componentSource, /\.\.\.LIQUID_LENS/);
  assert.equal((componentSource.match(/chromaAmount: \.24, edgeWidth: \.9/g) ?? []).length, 3);
  assert.equal((componentSource.match(/refractionPixels=\{thumbHeight \* \.22\}/g) ?? []).length, 2);
  assert.match(componentSource, /refractionPixels=\{5\.5\}/);
  const scaleCode = liquidAdapterSource.match(/const scale = props\.refractionPixels[\s\S]*?;/)?.[0];
  const ratioCode = liquidAdapterSource.match(/refractionRatio=\{([^}]+)\}/)?.[1];
  assert.ok(scaleCode && ratioCode);
  const gain = new Function("props", "lens", "size", `${scaleCode}\nreturn [scale, ${ratioCode}];`);
  for (const [width, height] of [[124, 78], [290, 72], [698, 206], [490, 206]]) {
    const [scale, ratio] = gain({ refractionPixels: 4.84 }, LIQUID_GLASS_MATERIAL, { width, height });
    for (const [axis, length] of [width, height].entries()) {
      assert.ok(Math.abs(scale * .5 * ratio[axis] * length - 4.84) < 1e-9, "padding and aspect ratio must not amplify refraction");
    }
  }
  assert.deepEqual(gain({}, { scaleX: .08, scaleY: .12 }, { width: 124, height: 78 }), [.12, [.08 / .12, 1]], "existing objectBoundingBox callers keep their optics");
  assert.equal(LIQUID_GLASS_MATERIAL.chromaAmount, .55);
  assert.match(componentSource, /SEGMENTED_TRAVEL_SPRING = \{ mass: 1, stiffness: 260, damping: 28 \}/);
  assert.match(componentSource, /SEGMENTED_HOLD_IMPACT_SCRIPT = \{\s*stiffness: 360,\s*damping: 24,\s*impulse: -1\.6,/s);
});

test("Slider's refracted fill retains a moving round cap at every progress", () => {
  const source = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/source.ts", import.meta.url), "utf8");
  const painterCode = source.slice(source.indexOf("export function liquidTrackSource"), source.indexOf("const svgImages"));
  const trackSource = new Function("readMotion", "liquidBackground", "liquidCssColor",
    `${stripTypeScriptTypes(painterCode).replace("export function", "function")}\nreturn liquidTrackSource;`,
  )(value => typeof value === "number" ? value : value.get(), () => "background", (_, token) => token);
  const offset = motionValue(0);
  const painter = trackSource({ kind: "slider", width: 240, trackHeight: 17, travel: 196, offset, scaleX: .95, scaleY: .975 })({ parentElement: {} }, 290, 72);
  for (const progress of [0, .01, .5, .99, 1]) {
    offset.set(progress * 196);
    let x = 0, y = 0, path;
    const fills = [];
    const ctx = {
      save() {}, restore() {}, beginPath() {}, clip() {},
      translate(dx, dy) { x += dx; y += dy; },
      roundRect(rx, ry, width, height, radius) { path = { x: x + rx, y: y + ry, width, height, radius }; },
      fillRect() { assert.equal(this.fillStyle, "background", "the active fill must not be rectangular"); },
      fill() { fills.push({ ...path }); },
    };
    painter(ctx);
    const cap = fills.at(-1);
    assert.equal(cap.radius, 17 * .975 / 2);
    assert.equal(cap.width, 240 * .95, "translate a complete capsule, including at near-zero progress");
    assert.ok(Math.abs(cap.x + cap.width - (145 + 228 * (progress - .5))) < 1e-9);
  }
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
