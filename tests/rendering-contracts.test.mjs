import { liquidContentPose, liquidContentOptics } from "../packages/react-liquid-glass/dist/liquid-glass.js";
import assert from "node:assert/strict";
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
  motionValue,
  LIQUID_GLASS_MATERIAL,
} from "../packages/react-liquid-glass/dist/index.js";

const appSource = readFileSync(new URL("../apps/docs/src/App.tsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../apps/docs/src/main.tsx", import.meta.url), "utf8");
const libraryIndexSource = readFileSync(new URL("../packages/react-liquid-glass/src/index.ts", import.meta.url), "utf8");
const libraryConfigSource = readFileSync(new URL("../packages/react-liquid-glass/vite.config.mjs", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../packages/react-liquid-glass/package.json", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const additionalDemosSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassActionButton.tsx", import.meta.url), "utf8");
const liquidDemoSource = [
  "lib/controls/LiquidMenu.tsx", "lib/apple-motion/use-menu-motion.ts",
  "lib/controls/use-menu-material.ts", "lib/apple-motion/menu.ts", "lib/controls/glass-thickness.ts",
].map(path => readFileSync(new URL(`../${path.startsWith("lib/") ? "packages/react-liquid-glass/src/" + path.slice(4) : "apps/docs/src/" + path}`, import.meta.url), "utf8")).join("\n");
const liquidCanvasUrl = new URL("../packages/react-liquid-glass/src/liquid-glass/LiquidGlassCanvas.tsx", import.meta.url);
const liquidRendererSource = ["webgl2-renderer.ts", "frame-geometry.ts", "render-frame.ts"].map(file => readFileSync(new URL(`../packages/react-liquid-glass/src/liquid-glass/${file}`, import.meta.url), "utf8")).join("\n");
const liquidAdapterSource = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/LiquidGlass.tsx", import.meta.url), "utf8");
const liquidCanvasSource = readFileSync(liquidCanvasUrl, "utf8") + liquidRendererSource;
const indexSource = readFileSync(new URL("../apps/docs/index.html", import.meta.url), "utf8");
const heroSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassSpotlight.tsx", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/tween.ts", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../apps/docs/src/styles.css", import.meta.url), "utf8");
const demoStylesSource = readFileSync(new URL("../apps/docs/src/styles/demos.css", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/controls.css", import.meta.url), "utf8");
const pageStylesSource = readFileSync(new URL("../apps/docs/src/styles/page.css", import.meta.url), "utf8");
const baseStylesSource = readFileSync(new URL("../apps/docs/src/styles/base.css", import.meta.url), "utf8");
const libraryStylesSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls.css", import.meta.url), "utf8");
const componentSource = [
  "apple-motion/react.ts", "controls/use-thumb-motion.ts", "controls/GlassSwitch.tsx",
  "apple-motion/presets.ts", "controls/GlassSlider.tsx", "controls/GlassSegmented.tsx",
].map(path => readFileSync(new URL(`../packages/react-liquid-glass/src/${path}`, import.meta.url), "utf8")).join("\n");
const pointerFallbackSource = readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/use-pointer-release-fallback.ts", import.meta.url), "utf8");
const videoSource = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassVideo.tsx", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/spring.ts", import.meta.url), "utf8") + readFileSync(new URL("../packages/react-liquid-glass/src/apple-motion/presets.ts", import.meta.url), "utf8");
const gitignoreSource = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

test("small controls retain sharp 2x Liquid surfaces and only draw when dirty", () => {
  assert.equal((componentSource.match(/sourceFactory=\{sourceFactory\}/g) ?? []).length, 2);
  assert.match(liquidCanvasSource, /frame\.render\(drawFrame\)/);
  assert.match(liquidCanvasSource, /if \(!visible \|\| document\.hidden \|\| !source\) return/);
  assert.doesNotMatch(liquidAdapterSource, /requestAnimationFrame|toDataURL/);
  assert.equal((componentSource.match(/pixelRatio=\{2\}/g) ?? []).length, 2, "small thumbs must not upscale 1x coverage on Retina screens");
  assert.equal((componentSource.match(/const restTintBlur = compact \? 0 : 4/g) ?? []).length, 2);
});

test("slider track clicks spring to the target and dragging takes over without a jump", () => {
  assert.match(componentSource, /const SLIDER_CLICK_SPRING = \{ mass: 0\.8, stiffness: 300, damping: 24 \}/);
  assert.match(componentSource, /clickAnimation\.current = settleThumb\(offset, next, SLIDER_CLICK_SPRING, reduce\)/);
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
  // Plain glass keeps its fine contour and inset crest: the crest's band covers the rim's inner
  // falloff, which a line hugging the edge left showing over light content as an inner shadow.
  assert.match(liquidCanvasSource, /float contour = 1\. - smoothstep\(0\., edgeWidth \* mix\(\.48, \.65, edgeLight\), inside\)/);
  assert.match(liquidCanvasSource, /float reflection = smoothstep\(edgeWidth \* \.45, edgeWidth \* \.85, inside\)\s*\* \(1\. - smoothstep\(edgeWidth \* \.85, edgeWidth \* 2\., inside\)\)/);
  // Every rim line reaches round toward the sides, faint there, as the lifted lens's does.
  assert.match(liquidCanvasSource, /float reflectionLight = \.42 \* smoothstep\(uLens \? \.12 : \.25, uLens \? \.72 : \.8, edgeLight\) \+ \(uLens \? \.15 : \.58\) \* smoothstep\(\.8, \.98, edgeLight\)/);
  // The dark contour follows edge strength alone, so an HDR display's lower SDR highlight keeps the edge.
  assert.match(liquidCanvasSource, /min\(uLens \? \.95 : \.85, max\(uEdgeStrength, 0\.\) \* 3\.2\) \* mix\(\.85, \.24, edgeLight\)/);
  // iOS 27's edge darkens on every substrate: no grey outline on dark content. On light content
  // the lens's contour is an even grey line all round: its wide ends lighten, its narrow top and
  // bottom darken to match.
  assert.match(liquidCanvasSource, /float contourAmount = contour \* contourStrength \* \(uLens \? mix\(1\., mix\(\.38, 1\.3, edgeLight\), smoothstep\(\.45, \.85, luminance\)\) : 1\.\);\s*refracted = refracted \* \(1\. - contourAmount\);/);
  assert.doesNotMatch(liquidCanvasSource, /vec3\(contourAmount/);
  assert.match(liquidCanvasSource, /float rimLight = reflection \* reflectionLight \* edgeGain/);
  assert.match(liquidCanvasSource, /vec3 crest = vec3\(rimLight\);/);
  assert.match(liquidCanvasSource, /refracted \+= crest \* mix\(\.5, \.3, smoothstep\(\.2, \.5, luminance\)\)/);
  assert.match(liquidCanvasSource, /refracted \* \(1\. - shine\)/);
  assert.doesNotMatch(liquidCanvasSource, /edgeShare/);
  assert.doesNotMatch(liquidCanvasSource, /sceneNormal|insetRim/);
  assert.equal((liquidCanvasSource.match(/= sceneSdf\(/g) ?? []).length, 3, "edge profiles reuse the existing SDF distances");
  assert.match(liquidCanvasSource, /vec3 sampleChroma\(sampler2D source, vec2 uv, Bend bend\)/);
  assert.match(liquidCanvasSource, /if \(blur <= \.001\) return sampleChroma\(uSource, uv, bend\)/);
  assert.match(liquidCanvasSource, /if \(blur >= \.75\) return sampleFrost\(uv, bend\)/);
  assert.match(liquidCanvasSource, /vec2 stepSize = vec2\(blur \* 1\.34\) \/ uSourceSize/);
  assert.equal((liquidCanvasSource.match(/frosted \+= sampleChroma/g) ?? []).length, 8);
  assert.match(liquidCanvasSource, /smoothstep\(\.5, \.75, blur\)\) : frosted/);
  // Dome and bevel keep their dispersion order through the per-channel bend.
  assert.match(liquidCanvasSource, /if \(uBevel\) return Bend\(displacement, middle, outer\);\s*return Bend\(outer, middle, displacement\);/);
  assert.match(liquidCanvasSource, /vec3 refracted = sampleGlass\(vUv, bend, frost\)/);
  const specularCompositeIndex = liquidCanvasSource.indexOf("float shine = specular * uSpecular");
  const brightnessCompositeIndex = liquidCanvasSource.indexOf("refracted = mix(refracted, brightnessTarget");
  const tintCompositeIndex = liquidCanvasSource.indexOf("refracted = mix(refracted, uTintColor");
  const contourCompositeIndex = liquidCanvasSource.indexOf("refracted = refracted * (1. - contourAmount)");
  const reflectionCompositeIndex = liquidCanvasSource.indexOf("refracted += crest");
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
  assert.match(liquidCanvasSource, /domeDepth\?: MotionInput/);
  assert.match(liquidCanvasSource, /brightness\?: MotionInput/);
  assert.match(liquidCanvasSource, /vec2 deformed = direction \* along \+ tangent \* across/);
  assert.doesNotMatch(liquidCanvasSource, /vec2 deformed = vec2\(\s*dot\(delta, direction\)/s);
  assert.doesNotMatch(liquidCanvasSource, /uTrail|movingTrail|tailBlob/i);
  assert.match(libraryIndexSource, /LiquidGlassCanvas/);
  assert.match(libraryIndexSource, /LiquidGlassBlob/);
});

test("WebGPU darkens the edge and brightens the dark crest exactly as WebGL2 does", () => {
  const wgsl = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/shaders/glass.wgsl", import.meta.url), "utf8");
  assert.match(wgsl, /let contourAmount = contour \* contourStrength \* select\(1\.0, mix\(1\.0, mix\(0\.38, 1\.3, edgeLight\), smoothstep\(0\.45, 0\.85, luminance\)\), lens\);\s*refracted = refracted \* \(1\.0 - contourAmount\);/);
  assert.doesNotMatch(wgsl, /vec3f\(contourAmount/);
  assert.match(wgsl, /let crest = vec3f\(rimLight\);/);
  assert.match(wgsl, /refracted \+= crest \* mix\(0\.5, 0\.3, smoothstep\(0\.2, 0\.5, luminance\)\)/);
});

test("the lifted lens model is the same on WebGPU and WebGL2", () => {
  const wgsl = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/shaders/glass.wgsl", import.meta.url), "utf8");
  const gpu = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/webgpu-renderer.ts", import.meta.url), "utf8");
  // Magnified middle fading as the square root of the band, and an outward bulge,
  // (sqrt(band) * (1 - band))^1.5 normalised to peak at 1, flush at the rim.
  assert.match(wgsl, /let rise = sqrt\(band\);\s*let swell = rise \* \(1\.0 - band\);/);
  assert.match(liquidCanvasSource, /float rise = sqrt\(band\);\s*float swell = rise \* \(1\. - band\);/);
  // The band pulls in and mirrors its surroundings all round, ends included, as native's does, so
  // the end of a bar the lens overhangs is drawn in concentric with its rim.
  assert.match(wgsl, /displacement = -lensNormal \* \(swell \* sqrt\(swell\) \* 4\.1877\) \* \(bevelRatio \/ max\(materialWeight, 0\.001\)\) \* \(p\.refraction\.y \* 0\.5\)/);
  assert.match(liquidCanvasSource, /displacement = -lensNormal \* \(swell \* sqrt\(swell\) \* 4\.1877\) \* \(bevelRatio \/ max\(materialWeight, \.001\)\) \* \(uRefraction \* \.5\)/);
  assert.doesNotMatch(wgsl, /4\.1877 \* longSide|refraction\.y \* longSide|band\) \* longSide/);
  assert.doesNotMatch(liquidCanvasSource, /4\.1877 \* longSide|uRefraction \* longSide|band\) \* longSide/);
  // Only the rim's shade keeps to the long sides.
  assert.match(wgsl, /lensAxis \+= select\(vec2f\(1\.0, 0\.0\), vec2f\(0\.0, 1\.0\), b\.sizeVelocity\.x >= b\.sizeVelocity\.y\) \* weight;/);
  assert.match(liquidCanvasSource, /lensAxis \+= \(uHalfSize\[index\]\.x >= uHalfSize\[index\]\.y \? vec2\(0\., 1\.\) : vec2\(1\., 0\.\)\) \* weight;/);
  assert.match(wgsl, /longSide = smoothstep\(0\.3, 0\.9, abs\(dot\(lensNormal, lensAxis \/ max\(length\(lensAxis\), 0\.0001\)\)\)\);/);
  assert.match(liquidCanvasSource, /longSide = smoothstep\(\.3, \.9, abs\(dot\(lensNormal, lensAxis \/ max\(length\(lensAxis\), \.0001\)\)\)\);/);
  assert.match(wgsl, /\(1\.0 - 1\.0 \/ max\(p\.ratio\.z, 1\.0\)\) \* \(1\.0 - rise\) \* coverage/);
  assert.match(liquidCanvasSource, /\(1\. - 1\. \/ max\(uLensZoom, 1\.\)\) \* \(1\. - rise\) \* coverage/);
  // The band keeps green's full pull, so its ends stay round; the rim's outer slope mirrors
  // what lies inside it, its reach dispersing along the diagonals; only the outer band frosts.
  assert.match(wgsl, /let diagonal = 2\.0 \* lensNormal\.x \* lensNormal\.y;/);
  assert.match(liquidCanvasSource, /float diagonal = 2\. \* lensNormal\.x \* lensNormal\.y;/);
  assert.match(wgsl, /let redReach = \(0\.1 \+ 0\.5 \* diagonal\) \* p\.refraction\.z;\s*let blueReach = \(0\.02 \+ 0\.6 \* diagonal\) \* p\.refraction\.z;\s*let rimDepth = inside \/ max\(0\.22 \* p\.frost\.y, 0\.001\);/);
  assert.match(liquidCanvasSource, /float redReach = \(\.1 \+ \.5 \* diagonal\) \* uChroma;\s*float blueReach = \(\.02 \+ \.6 \* diagonal\) \* uChroma;\s*float rimDepth = inside \/ max\(\.22 \* uDepth, \.001\);/);
  assert.match(wgsl, /let mirror = lensNormal \* \(0\.45 \* p\.refraction\.y\) \* \(bevelRatio \/ max\(materialWeight, 0\.001\)\) \* coverage \* p\.tint\.w \* p\.ratio\.xy;/);
  assert.match(liquidCanvasSource, /vec2 mirror = lensNormal \* \(\.45 \* uRefraction\) \* \(bevelRatio \/ max\(materialWeight, \.001\)\) \* coverage \* uZoom \* uRefractionRatio;/);
  assert.match(wgsl, /lensZoom \+ displacement \+ mirror \* max\(1\.0 - rimDepth, 0\.0\),/);
  assert.match(liquidCanvasSource, /lensZoom \+ displacement \+ mirror \* max\(1\. - rimDepth, 0\.\),/);
  assert.match(wgsl, /lensZoom \+ displacement \* \(1\.0 \+ spread\) \+ mirror \* max\(1\.0 \+ redReach - rimDepth, 0\.0\)/);
  assert.match(liquidCanvasSource, /lensZoom \+ displacement \* \(1\. \+ spread\) \+ mirror \* max\(1\. \+ redReach - rimDepth, 0\.\)/);
  assert.match(wgsl, /lensZoom \+ displacement \* \(1\.0 - spread\) \+ mirror \* max\(1\.0 - blueReach - rimDepth, 0\.0\)/);
  assert.match(liquidCanvasSource, /lensZoom \+ displacement \* \(1\. - spread\) \+ mirror \* max\(1\. - blueReach - rimDepth, 0\.\)/);
  assert.doesNotMatch(wgsl, /tilt \* abs\(diagonal\)/);
  assert.doesNotMatch(liquidCanvasSource, /tilt \* abs\(diagonal\)/);
  // The shade is the same in every channel, so bright content is never tinted. Over dark content
  // it runs all round, as native's does; over light content it fades out, as native's rim is white
  // inside its contour there.
  assert.match(wgsl, /var rimShade = 0\.0;/);
  assert.match(liquidCanvasSource, /float rimShade = 0\.;/);
  // A quarter as deep at the ends, where native's edge is a crisp line with a faint tail, and
  // following edge strength like the contour, so a lens settled flat has none.
  assert.match(wgsl, /rimShade = 0\.4 \* max\(1\.0 - rimDepth, 0\.0\) \* mix\(0\.25, 1\.0, longSide\) \* smoothstep\(0\.0, 0\.5, p\.edge\.x\);/);
  assert.match(liquidCanvasSource, /rimShade = \.4 \* max\(1\. - rimDepth, 0\.\) \* mix\(\.25, 1\., longSide\) \* smoothstep\(0\., \.5, uEdgeStrength\);/);
  assert.match(wgsl, /refracted = refracted \* \(1\.0 - rimShade \* \(1\.0 - smoothstep\(0\.45, 0\.85, dot\(refracted, vec3f\(0\.299, 0\.587, 0\.114\)\)\)\)\);/);
  assert.match(liquidCanvasSource, /refracted \*= 1\. - rimShade \* \(1\. - smoothstep\(\.45, \.85, dot\(refracted, vec3\(\.299, \.587, \.114\)\)\)\);/);
  assert.match(wgsl, /frost \*= smoothstep\(0\.45, 0\.9, band\);/);
  assert.match(liquidCanvasSource, /frost \*= smoothstep\(\.45, \.9, band\);/);
  // Plain glass keeps its inset crest; the lens's contour and rim line hug its edge. Every rim
  // line reaches round toward the sides, faint there; plain glass keeps a full top and bottom crest.
  assert.match(wgsl, /var contour = 1\.0 - smoothstep\(0\.0, edgeWidth \* mix\(0\.48, 0\.65, edgeLight\), inside\);/);
  assert.match(wgsl, /var reflection = smoothstep\(edgeWidth \* 0\.45, edgeWidth \* 0\.85, inside\) \* \(1\.0 - smoothstep\(edgeWidth \* 0\.85, edgeWidth \* 2\.0, inside\)\);/);
  // The lens's contour is a little wider at its ends, and its rim line sits just inside it.
  assert.match(wgsl, /if \(lens\) \{[^}]*contour = 1\.0 - smoothstep\(0\.0, edgeWidth \* mix\(0\.8, 0\.55, edgeLight\), inside\);\s*reflection = smoothstep\(edgeWidth \* 0\.2, edgeWidth \* 0\.6, inside\) \* \(1\.0 - smoothstep\(edgeWidth \* 0\.6, edgeWidth \* 1\.4, inside\)\);\s*\}/);
  assert.match(liquidCanvasSource, /if \(uLens\) \{[^}]*contour = 1\. - smoothstep\(0\., edgeWidth \* mix\(\.8, \.55, edgeLight\), inside\);\s*reflection = smoothstep\(edgeWidth \* \.2, edgeWidth \* \.6, inside\) \* \(1\. - smoothstep\(edgeWidth \* \.6, edgeWidth \* 1\.4, inside\)\);\s*\}/);
  assert.match(wgsl, /let reflectionLight = 0\.42 \* smoothstep\(select\(0\.25, 0\.12, lens\), select\(0\.8, 0\.72, lens\), edgeLight\) \+ select\(0\.58, 0\.15, lens\) \* smoothstep\(0\.8, 0\.98, edgeLight\);/);
  assert.match(wgsl, /let contourStrength = min\(select\(0\.85, 0\.95, lens\), max\(p\.edge\.x, 0\.0\) \* 3\.2\) \* mix\(0\.85, 0\.24, edgeLight\);/);
  assert.match(gpu, /p\.refractionModel === "lens" \? 2 : Number\(p\.refractionModel === "bevel"\)/);
  assert.match(gpu, /number\(p, "lensMagnification"\), 0\], 40\)/);
  assert.match(liquidCanvasSource, /gl\.uniform1i\(u\.uLens, p\.refractionModel === "lens" \? 1 : 0\)/);
  assert.match(liquidCanvasSource, /lensMagnification: "uLensZoom"/);
  // The lens draws its own rim light, so a model change must refresh the retained HDR mask.
  assert.match(liquidCanvasSource, /Number\(p\.contentSpace === "source"\), p\.refractionModel === "lens" \? 2 : Number\(p\.refractionModel === "bevel"\)\]\) record\(value\);/);
  // Providers can choose the lens model too.
  const provider = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/provider.tsx", import.meta.url), "utf8");
  assert.match(provider, /refractionModel\?: "dome" \| "bevel" \| "lens";/);
  assert.match(provider, /\| "lensMagnification"/);
});

test("popups thicken with size under the same rule as the Morph Menu", () => {
  const popover = readFileSync(new URL("../packages/react-liquid-glass/src/controls/LiquidPopover.tsx", import.meta.url), "utf8");
  const thickness = readFileSync(new URL("../packages/react-liquid-glass/src/controls/glass-thickness.ts", import.meta.url), "utf8");
  // Thin glass is the compact-control calibration; thick glass is the approved open menu.
  assert.match(thickness, /refractionStrength: SURFACE_MATERIAL\.refractionStrength,[\s\S]*chromaAmount: DEFAULT_MATERIAL\.chromaAmount,[\s\S]*shadowBlur: SURFACE_MATERIAL\.shadowBlur,/s);
  assert.match(thickness, /const thin = Math\.min\(12, shortSide \* \.12\);\s*return thin \+ \(26 - thin\) \* thickness;/);
  assert.match(thickness, /return Math\.ceil\(Math\.max\(28, blur \* 3 \+ Math\.abs\(offset\)\)\)/);
  assert.match(thickness, /material\[key\] = overrides\[key\] \?\? value/);
  assert.match(popover, /const thickness = useTransform\(\(\) => liquidThickness\(model\.w\.get\(\) \* 2, model\.h\.get\(\) \* 2\)\)/);
  assert.match(popover, /const thicknessMaterial = useGlassThickness\(thickness, dark, overrides\)/);
  assert.match(popover, /const padding = glassShadowReach\(liquidThickness\(pw, ph\), overrides\)/);
  assert.match(popover, /\{\.\.\.thicknessMaterial\} tintColor=\{dark \? DARK_GLASS_TINT : undefined\}/);
  assert.match(popover, /edgeDepth=\{edgeDepth\} blurStrength=\{backgroundBlur\}/);
  assert.doesNotMatch(popover, /shadowStrength=\{\.08\}|edgeDepth=\{10\}/);
});

test("liquid menu keeps one core-compatible Canvas material over the shared backdrop", () => {
  assert.doesNotMatch(liquidDemoSource, /buildQrGeometry|QR_SIZE|QR_GEOMETRY|occupancy|MENU_ACTIONS/);
  assert.match(liquidDemoSource, /import \{ DARK_GLASS_TINT, THIN_GLASS, glassEdgeDepth, useGlassThickness \} from "\.\/glass-thickness\.js"/);
  assert.match(liquidDemoSource, /import \{ LiquidGlassCanvas \} from "\.\.\/liquid-glass\/LiquidGlassCanvas\.js"/);
  assert.doesNotMatch(liquidDemoSource, /<Glass|coreOpacity|fusionOpacity/);
  // The approved menu material is the thick end of the shared thickness rule.
  assert.doesNotMatch(liquidDemoSource, /MENU_LENS|menuLens/);
  assert.match(liquidDemoSource, /refractionStrength: LIQUID_GLASS_MATERIAL\.refractionStrength,[\s\S]*chromaAmount: LIQUID_GLASS_MATERIAL\.chromaAmount,[\s\S]*domeDepth: LIQUID_GLASS_MATERIAL\.domeDepth,[\s\S]*shadowBlur: LIQUID_GLASS_MATERIAL\.shadowBlur,/s);
  assert.match(liquidDemoSource, /export const THICK_GLASS_DARK: Record<ThicknessKey, number> = \{ \.\.\.THICK_GLASS, brightness: \.035, glowStrength: \.38, edgeStrength: \.42 \}/);
  assert.equal(LIQUID_GLASS_MATERIAL.chromaAmount, .55);
  assert.equal(LIQUID_GLASS_MATERIAL.refractionStrength, .11);
  assert.equal(LIQUID_GLASS_MATERIAL.specularStrength, .72);
  assert.equal(LIQUID_GLASS_MATERIAL.glowSpread, .72);
  assert.equal(LIQUID_GLASS_MATERIAL.glowStrength, .3);
  assert.equal(LIQUID_GLASS_MATERIAL.edgeWidth, 1.6);
  assert.equal(LIQUID_GLASS_MATERIAL.specularRotation, 90);
  assert.equal(LIQUID_GLASS_MATERIAL.edgeStrength, .36);
  assert.equal(LIQUID_GLASS_MATERIAL.shadowStrength, .11);
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
  // Thickness follows the live body: a closed trigger is thin glass, the open menu thick.
  assert.match(liquidDemoSource, /const thickness = useTransform\(\[halfWidth, halfHeight\], \(\[width, height\]: number\[\]\) => liquidThickness\(width \* 2, height \* 2\)\)/);
  assert.match(liquidDemoSource, /useGlassThickness\(thickness, theme === "dark", materialOverrides, scale\)/);
  assert.match(liquidDemoSource, /const materialBlur = useTransform\(\[halfWidth, halfHeight\], \(\[width, height\]: number\[\]\) => liquidSurfaceBlur\(width \* 2, height \* 2\) \/ scale\)/);
  assert.match(liquidDemoSource, /const thinDepth = glassEdgeDepth\(TRIGGER_RADIUS \* 2, 0\)/);
  assert.match(liquidDemoSource, /const materialDepth = useTransform\(\[thickness, depth\], \(\[t, value\]: number\[\]\) => thinDepth \+ \(value - thinDepth\) \* t\)/);
  assert.match(liquidDemoSource, /const materialTintOpacity = useTransform\(\[thickness, tintOpacity\], \(\[t, value\]: number\[\]\) => THIN_GLASS\.tintStrength \+ \(value - THIN_GLASS\.tintStrength\) \* t\)/);
  assert.match(liquidDemoSource, /const materialZoom = useTransform\(\[thickness, zoom\], \(\[t, value\]: number\[\]\) => 1 \+ \(value - 1\) \* t\)/);
  // The trigger presses like other glass buttons: contact light and a 2.5% growth, no lens pulse.
  assert.doesNotMatch(liquidDemoSource, /buttonDepth|buttonTintOpacity|buttonZoom|onPress: press/);
  assert.match(liquidDemoSource, /const contact = useGlassContact\(triggerRef, \{ deform: false \}\)/);
  assert.match(liquidDemoSource, /contactStrength: contact\.contactStrength,/);
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
  assert.match(liquidDemoSource, /\{\.\.\.material\}\s*edgeDepth=\{materialDepth\}/);
  assert.match(liquidDemoSource, /inheritMaterial=\{false\}\s*\{\.\.\.materialOverrides\}/);
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
  assert.match(liquidDemoSource, /tintColor=\{theme === "dark" \? DARK_GLASS_TINT : \[1, 1, 1\]\}/);
  assert.match(liquidDemoSource, /export const DARK_GLASS_TINT = \[74 \/ 255, 74 \/ 255, 70 \/ 255\] as const/);
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
  assert.match(liquidDemoSource, /<ScrollArea className="dg-liquid-menu__scroll"/);
  assert.match(demoStylesSource, /\.dg-liquid-menu__scroll-content \{[\s\S]*?padding:\s*14px;/s);
  assert.match(demoStylesSource, /\.dg-liquid-glass \{[\s\S]*?--dg-liquid-menu-radius:\s*44px;[\s\S]*?--dg-liquid-item-radius:\s*31px;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__sort-row,[\s\S]*?\.dg-liquid-menu__filter-row \{[\s\S]*?border-radius:\s*var\(--dg-liquid-item-radius\);/s);
  assert.match(demoStylesSource, /\.dg-liquid-glass,[\s\S]*?\.dg-liquid-menu__panel,[\s\S]*?\.dg-liquid-menu__scroll \.dg-scroll-area__thumb[\s\S]*?corner-shape:\s*squircle;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__sort-row,[\s\S]*?\.dg-liquid-menu__filter-row \{[\s\S]*?corner-shape:\s*round;/s);
  assert.doesNotMatch(demoStylesSource, /\.dg-liquid-menu__glass \*/);
  assert.match(demoStylesSource, /\.dg-liquid-menu__trigger \{[\s\S]*?border-radius:\s*50%;[\s\S]*?corner-shape:\s*round;/s);
  assert.match(demoStylesSource, /\.dg-liquid-menu__sort-row \{[\s\S]*?height:\s*64px;[\s\S]*?min-height:\s*64px;/s);
  assert.doesNotMatch(demoStylesSource, /\.dg-liquid-menu__sort-row\[data-selected="true"\][^{]*\{[^}]*height/s);
  assert.match(demoStylesSource, /@media \(max-width: 640px\)[\s\S]*?\.dg-liquid-menu__scroll-content \{ padding: 10px; \}/s);
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
  assert.match(liquidCanvasSource, /local - \(displacement \+ lensZoom\) \* uSourceSize \* \.42 \* uContentRefraction \* edgeFocus/);
  assert.match(liquidCanvasSource, /texture\(uContent, uv, log2\(1\. \+ blur \* 2\.\)\)/);
  assert.match(liquidCanvasSource, /ink = sampleContent\(contentUv, uContentBlur\) \* uContentOpacity/);
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
  assert.match(libraryStylesSource, /html:is\(\[data-theme="dark"\], :where\(\.dark:not\(\[data-theme\]\)\)\) \.dg-switch\s*\{\s*--dg-switch-on:\s*#777773/);
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
  assert.match(componentSource, /to\(tintOpacity, 0, pressTransition\)/);
  assert.match(componentSource, /rubberBand\(-next, overshoot/);
  assert.match(componentSource, /inputRef\.current\?\.focus/);
  assert.doesNotMatch(componentSource, /dg-slider__value/);
  assert.match(componentSource, /duration: 0\.6/);
  assert.match(componentSource, /return Math\.min\(0\.18, speed \* SEGMENTED_DEFORMATION\.perSpeed\)/);
  assert.doesNotMatch(componentSource, /zoom=\{zoom\}/, "the Tabs lens has no velocity zoom");
  assert.match(componentSource, /depth=\{band\}/);
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
  assert.match(componentSource, /const currentCenter = expanded\.left \+ x\.get\(\) \* expanded\.width/);
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
  assert.match(componentSource, /const nextX = \(centerX - expanded\.left\) \/ expanded\.width/);
  assert.match(componentSource, /x\.set\(nextX\)/);
  assert.match(componentSource, /lensW\.set\(\(from\.width \+ \(to\.width - from\.width\) \* blend\) \/ 2 \/ expanded\.scale\.x\)/, "the dragged lens morphs between tab widths instead of popping");
  assert.match(componentSource, /className="dg-tabs__solid-thumb"/);
  assert.match(componentSource, /className="dg-tabs__glass-layer"/);
  assert.match(libraryStylesSource, /\.dg-tabs__solid-thumb[^}]*background:\s*rgba\(18, 18, 22, \.08\)/s);
  assert.doesNotMatch(libraryStylesSource, /\.dg-tabs__solid-thumb[^}]*background:\s*var\(--primary\)/s);
  assert.match(componentSource, /const solidOpacity = useMotionValue\(1\)/);
  assert.match(componentSource, /<motion\.div className="dg-tabs__glass-layer" aria-hidden style=\{\{ opacity: glassOpacity \}\}>/);
  assert.doesNotMatch(libraryStylesSource, /dg-tabs__item:nth-child/);
});

test("segmented click expands, travels as glass, then collapses", () => {
  assert.match(componentSource, /return x\.on\("change", \(position\) => \{[\s\S]*pointerX\.set\(expanded\.left \+ position \* expanded\.width\)/);
  assert.match(componentSource, /choose\(nearest\.value\);\s*travelSettled\.current = updateGeometry\(nearest\.value, hasLinks && !selected\);/);
  assert.match(componentSource, /if \(dragMoved\.current\) moveDrag\(event\.clientX\)/);
  assert.match(componentSource, /releaseInteraction\(0, dragMoved\.current\)/);
  assert.match(componentSource, /const releaseInteraction = \(delay = 0, settle = true\)/);
  assert.match(componentSource, /const travel = settle \? updateGeometry\(selectedRef\.current, false\) : travelSettled\.current/);
  assert.match(componentSource, /const liftOutset = useTransform\(\(\) => interaction\.get\(\) \* SEGMENTED_LIFT_OUTSET \* 2 \* lensH\.get\(\)\);/);
  assert.match(componentSource, /useDerivedMotion2\(stretchedLensW, liftOutset, \(width, outset\) => width \+ outset\)/);
  assert.match(componentSource, /useDerivedMotion2\(stretchedLensH, liftOutset, \(height, outset\) => height \+ outset\)/);
});

test("segmented lens overflows the bar, refracts its edge and keeps tab text sharp", () => {
  assert.match(componentSource, /export const SEGMENTED_LIFT_OUTSET = 0\.17;/, "the lens outgrows its tab by 0.17 of the tab's height a side: 9px on a native-sized 53px tab");
  assert.match(componentSource, /backdropRoot=\{groupRef\}/, "only the native tabs leave the backdrop; the bar stays visible through the lens");
  assert.match(componentSource, /\n\s*sharpInk\n/);
  assert.match(componentSource, /const container = useMemo\(\(\) => <GlassSurface className="dg-tabs__container" radius=\{999\} \/>, \[\]\)/, "selection changes never redraw the bar");
});

test("source-space ink refracts with the backdrop, sharp at the center and frosted at the rim", () => {
  const wgsl = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/shaders/glass.wgsl", import.meta.url), "utf8");
  const gpu = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/webgpu-renderer.ts", import.meta.url), "utf8");
  // Ink frosts where the rim shifts it, never because the lens model magnifies it.
  assert.match(liquidCanvasSource, /float blur = mix\(uContentBlur, uBlur, smoothstep\(1\., 4\., rimShift\)\)/);
  assert.match(liquidCanvasSource, /overlayInk\(refracted, vUv, bend, length\(displacement \* uSourceSize\)\)/);
  assert.match(wgsl, /let blur = mix\(p\.ink\.z, p\.frost\.x, smoothstep\(1\.0, 4\.0, rimShift\)\)/);
  assert.match(wgsl, /overlayInk\(refracted, uv, bend, length\(displacement \* p\.size\.xy\)\)/);
  // Ink joins the backdrop before shading, so the lens lights and tints both alike.
  assert.ok(liquidCanvasSource.indexOf("refracted = overlayInk(refracted, vUv, bend") < liquidCanvasSource.indexOf("float shine ="));
  assert.ok(wgsl.indexOf("refracted = overlayInk(refracted, uv, bend") < wgsl.indexOf("let shine ="));
  assert.match(liquidCanvasSource, /if \(uContentOpacity > \.001 && !uContentSource\)/);
  assert.match(wgsl, /if \(p\.ink\.x > 0\.001 && p\.ink\.w < 0\.5\)/);
  assert.match(liquidCanvasSource, /gl\.uniform1i\(u\.uContentSource, p\.contentSpace === "source" \? 1 : 0\)/);
  assert.match(gpu, /Number\(p\.contentSpace === "source"\)\], 32\)/);
  assert.match(liquidAdapterSource, /props\.sharpInk \? "base" : "all"/);
  assert.match(liquidAdapterSource, /captureLiquidSource\(root, width, height, undefined, "ink"\)/);
  assert.match(liquidAdapterSource, /contentRef=\{inkRef\} contentOpacity=\{props\.sharpInk \? 1 : 0\} contentSpace="source"/);
  assert.match(liquidAdapterSource, /else captureRef\.current\(true\)/, "a backdrop change reuses the captured ink");
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
  assert.match(componentSource, /waitForRest\(\[impactX, x\], \(\) => Math\.abs\(impactX\.get\(\) - impactTargetX\.current\) \* impactWidth\.current, SEGMENTED_HANDOFF\.arrivalPixels\)/);
  assert.match(componentSource, /\.then\(\(\) => \{\s*if \(token !== transitionToken\.current\) return;\s*interactionStop\.current\?\.stop\(\);\s*interactionStop\.current = springTo\(interaction, 0, SEGMENTED_RELEASE_SPRING\)/, "the lens stays lifted until it lands");
  assert.match(componentSource, /epsilon = 1, timeoutMs = 900, holdMs = 32/);
  assert.match(componentSource, /restTimer = window\.setTimeout\(finish, holdMs\)/);
  assert.match(componentSource, /animate\(glassOpacity, 0, SEGMENTED_HANDOFF\.dissolve\)/);
  assert.match(componentSource, /SEGMENTED_HANDOFF = \{ arrivalPixels: 4, dissolve: \{ duration: 0\.32/);
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
  assert.match(componentSource, /stiffness: \(\) => impactLanded\.current && stationaryPress\(\) \? SEGMENTED_HOLD_IMPACT_SCRIPT\.stiffness : SEGMENTED_DEFORMATION\.stiffness/);
  assert.match(componentSource, /if \(!impactLanded\.current\) return SEGMENTED_DEFORMATION\.damping/);
  assert.match(componentSource, /return SEGMENTED_DEFORMATION\.landedDamping/);
  assert.match(componentSource, /SEGMENTED_DEFORMATION = \{ perSpeed: 0\.00024, stiffness: 760, damping: 50, landedDamping: 30 \}/);
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
  assert.match(componentSource, /const heightBoost = useDerivedMotion2\(glassHeight, deformation, \(active, amount\) =>\s*active \* \(0\.18 - Math\.min\(0\.10, Math\.max\(0, amount\) \* 0\.55\)\)\);/s);
  assert.match(componentSource, /const minimumGlassH = useDerivedMotion2\(lensH, heightBoost, \(height, boost\) => height \* \(1 \+ boost\)\)/);
  assert.match(componentSource, /const renderedLensH = useDerivedMotion2\(expandedLensH, minimumGlassH, \(height, minimum\) => Math\.max\(height, minimum\)\)/);
  assert.match(componentSource, /glassHeight\.set\(1\)/);
  assert.match(componentSource, /springTo\(glassHeight, 0, SEGMENTED_HEIGHT_RELEASE_SPRING\)/);
  assert.doesNotMatch(componentSource, /useDerivedMotion2\(lensH, glassOpacity/);
});

test("segmented vertical boost collapses during settling instead of lingering", () => {
  assert.match(componentSource, /const SEGMENTED_HEIGHT_RELEASE_SPRING = \{ mass: 0\.8, stiffness: 260, damping: 23\.6 \}/);
  assert.match(componentSource, /heightStop\.current = springTo\(glassHeight, 0, SEGMENTED_HEIGHT_RELEASE_SPRING\)/);
  assert.match(componentSource, /heightStop\.current\?\.stop\(\);\s*glassHeight\.set\(1\)/);
  assert.doesNotMatch(componentSource, /fade\.then\(\(\) => \{[\s\S]*glassHeight\.set\(0\)/);
});

test("segmented final crossfade keeps content colors stable and compositor-only", () => {
  assert.match(componentSource, /<motion\.span ref=\{solidThumbRef\} className="dg-tabs__solid-thumb" aria-hidden style=\{\{ opacity: selected \? solidOpacity : 0 \}\} \/>/);
  assert.doesNotMatch(componentSource, /style\.setProperty\("--segmented-glass"/);
  assert.match(componentSource, /setAttribute\("data-crossfading", ""\)/);
  assert.match(componentSource, /removeAttribute\("data-crossfading"\)/);
  assert.match(libraryStylesSource, /\.dg-tabs > \.dg-tabs__group > \.dg-tabs__item\[data-selected\][^}]*color:\s*var\(--dg-control-text\)/s);
  assert.match(libraryStylesSource, /\.dg-tabs\[data-crossfading\] \.dg-tabs__group--glass-base \.dg-tabs__item\[data-selected\]/);
});

test("segmented final state attenuates optics over an already-present base material", () => {
  assert.match(componentSource, /animate\(solidOpacity, 0, \{ duration: 0\.1/);
  assert.match(componentSource, /updateSolidThumb\(selectedRef\.current, true\);\s*solidOpacity\.set\(1\);\s*rootRef\.current\?\.setAttribute\("data-crossfading", ""\)/);
  assert.match(componentSource, /if \(!force && rootRef\.current\?\.hasAttribute\("data-interacting"\)\) return;/, "the hidden solid thumb never slides out ahead of the lens");
  assert.match(libraryStylesSource, /\.dg-tabs\[data-interacting\] \.dg-tabs__solid-thumb \{ transition: none; \}/);
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
  assert.match(liquidAdapterSource, /data-dg-glass-surface=""/);
  const runtimeSource = [componentSource, heroSource, videoSource, liquidDemoSource, liquidCanvasSource, libraryStylesSource, demoStylesSource].join("\n");
  assert.match(runtimeSource, /dg-(?:control|switch|slider|tabs|hero|qr|video)/);
  assert.match(videoSource, /\.\.\/assets\/video\/pause\.svg\?raw/);
  assert.match(gitignoreSource, /^\.openai\/$/m);
  assert.match(gitignoreSource, /^\.dezin\/$/m);
});

test("core library stays CSS-free while optional controls ship standalone styles", () => {
  assert.doesNotMatch(libraryIndexSource, /import ["']\.\/(?:style|controls)\.css["']/);
  assert.match(stylesSource, /@import "rglass\/controls\.css"/);
  assert.equal(JSON.parse(packageSource).exports["./controls.css"].default, "./dist/controls.css");
  assert.doesNotMatch(packageSource, /"\.\/style\.css"/);
  assert.match(libraryConfigSource, /copyFileSync\(resolve\(import\.meta\.dirname, "src\/controls\.css"\), resolve\(libraryDir, "controls\.css"\)\)/);
  assert.doesNotMatch(readmeSource, /rglass\/style\.css/);
  assert.match(readmeSource, /rglass\/controls\.css/);
  assert.match(libraryStylesSource, /--dg-control-accent: var\(--primary, light-dark\(#262626, #dededb\)\)/);
  assert.match(libraryStylesSource, /--dg-control-track: var\(--bg-4, light-dark\(#dcdcd8, #2c2c2c\)\)/);
});





test("control optics retain size-independent pixel gain and the approved menu material", () => {
  assert.match(componentSource, /\.\.\.LIQUID_LENS/);
  assert.equal((componentSource.match(/chromaAmount: \.24, edgeWidth: \.9/g) ?? []).length, 1);
  // Held thumbs and the pressed tab are one lifted lens, iOS 27's, calibrated against a native
  // screenshot: clear glass whose rim band (0.33 of its radius) bulges out by 0.147 of its radius
  // as it lifts. Only the tab magnifies; the thumbs' refracted track already does.
  assert.equal((componentSource.match(/liftedLens\(dark, \{/g) ?? []).length, 3, "Switch, Slider and Segmented share one lifted lens");
  assert.match(componentSource, /chromaAmount: 1\.5, blurAmount: \.7, edgeWidth: 1\.2, edgeStrength: \.81, specularStrength: 1,\s*glowStrength: 0, brightness: 0, tint: 0, \.\.\.lens,/);
  assert.match(componentSource, /const band = useTransform\(\(\) => 2\.5 \+ \(Math\.min\(lensW\.get\(\), lensH\.get\(\)\) \* \.33 - 2\.5\) \* unit\(lift\.get\(\)\)\)/);
  assert.match(componentSource, /const bulge = useTransform\(\(\) => Math\.min\(lensW\.get\(\), lensH\.get\(\)\) \* \.147 \* unit\(lift\.get\(\)\)\)/);
  assert.equal((componentSource.match(/refractionPixels=\{1\}\s*zoom=\{bulge\}\s*depth=\{band\}\s*material=\{LIFTED_MODEL\}/g) ?? []).length, 2);
  assert.match(componentSource, /const LIFT_MAGNIFICATION = 1\.155;/);
  // The lens magnifies what lies under it for the whole press, held or dragged, as both iOS 27
  // screenshots show: it never shrinks back while a drag moves and grows again when it rests.
  assert.match(componentSource, /const magnify = useTransform\(\(\) => 1 \+ \(LIFT_MAGNIFICATION - 1\) \* Math\.min\(1, Math\.max\(0, interaction\.get\(\)\)\)\);/);
  assert.doesNotMatch(componentSource, /REST_DELAY|armResting|stopResting|resting\.get/);
  assert.match(componentSource, /dragMoved\.current = true;\s*stillStop\.current\?\.stop\(\);\s*stillStop\.current = springTo\(still, 0, SEGMENTED_PRESS_SPRING\);/);
  assert.match(componentSource, /if \(!dragMoved\.current\) return;\s*moveDrag\(event\.clientX\);/);
  // Dragged or held, the tab is the same lifted lens in both themes, as iOS 27's is; in light mode
  // it casts a soft shadow, scaled with its height, and on dark pages none.
  assert.match(componentSource, /refractionPixels=\{1\}\s*zoom=\{bulge\}\s*material=\{\{ refractionModel: "lens", lensMagnification: magnify, shadowStrength: liftShadow, shadowOffset: liftShadowOffset, shadowBlur: liftShadowBlur \}\}\s*lens=\{lens\}/);
  assert.match(componentSource, /const LIFT_SHADOW = \.06;\s*const LIFT_SHADOW_OFFSET = 8 \/ 36\.5;\s*const LIFT_SHADOW_BLUR = 10 \/ 36\.5;/);
  assert.match(componentSource, /const liftShadow = useTransform\(\(\) => LIFT_SHADOW \* Math\.min\(1, Math\.max\(0, interaction\.get\(\)\)\) \* lightTheme\.get\(\)\);/);
  assert.match(componentSource, /const liftShadowOffset = useTransform\(\(\) => renderedLensH\.get\(\) \* LIFT_SHADOW_OFFSET\);/);
  assert.match(componentSource, /const renderedLensW = useDerivedMotion2\(stretchedLensW, liftOutset,/);
  assert.match(componentSource, /const expandedLensH = useDerivedMotion2\(stretchedLensH, liftOutset,/);
  assert.match(componentSource, /useLiftedOptics\(renderedLensW, renderedLensH, interaction\)/);
  assert.doesNotMatch(componentSource, /PILL_COLOR|PILL_TINT|pillTint|rimStrength|const flat = /);
  assert.equal((componentSource.match(/strength => strength \* \.3/g) ?? []).length, 2, "held thumbs barely light where they are touched");
  // A held tab lights barely; once the press drags the glass does not light up, and the
  // selection's ink shows only through the moving lens, as on iOS 27.
  assert.match(componentSource, /const touchLight = useTransform\(\(\) => contact\.contactStrength\.get\(\) \* \.3 \* still\.get\(\)\);/);
  assert.match(componentSource, /stillStop\.current = springTo\(still, 0, SEGMENTED_PRESS_SPRING\);\s*setDragging\(true\);/);
  assert.match(componentSource, /const releaseInteraction = \(delay = 0, settle = true\) => \{\s*setDragging\(false\);/);
  assert.match(componentSource, /data-dragging=\{dragging \? "" : undefined\}/);
  assert.doesNotMatch(componentSource, /dg-tabs__group--quiet/);
  const controlsCss = readFileSync(new URL("../packages/react-liquid-glass/src/controls.css", import.meta.url), "utf8");
  assert.match(controlsCss, /\.dg-tabs\[data-dragging\] > \.dg-tabs__group > \.dg-tabs__item\[data-selected\] \{[^}]*color: var\(--dg-control-text-muted\);/);
  assert.doesNotMatch(controlsCss, /dg-tabs__group--quiet/);
  const scaleCode = liquidAdapterSource.match(/const scale = props\.refractionPixels[\s\S]*?;/)?.[0];
  const ratioCode = liquidAdapterSource.match(/refractionRatio=\{([^}]+)\}/)?.[1];
  assert.ok(scaleCode && ratioCode);
  const gain = new Function("props", "lens", "size", "canvasWidth", "canvasHeight", `${scaleCode}\nreturn [scale, ${ratioCode}];`);
  // A shadow bleed widens the canvas around the same element; pixel gain must not change with it.
  for (const [width, height, bleed] of [[124, 78, 0], [290, 72, 0], [698, 206, 0], [490, 206, 0], [124, 78, 49], [290, 72, 45]]) {
    const [scale, ratio] = gain({ refractionPixels: 4.84 }, LIQUID_GLASS_MATERIAL, { width, height }, width + bleed * 2, height + bleed * 2);
    for (const [axis, length] of [width + bleed * 2, height + bleed * 2].entries()) {
      assert.ok(Math.abs(scale * .5 * ratio[axis] * length - 4.84) < 1e-9, "padding and aspect ratio must not amplify refraction");
    }
  }
  const [pullScale, pullRatio] = gain({ refractionPixels: -14 }, LIQUID_GLASS_MATERIAL, { width: 290, height: 72 }, 450, 232);
  assert.ok(Math.abs(pullScale * .5 * pullRatio[0] * 450 + 14) < 1e-9, "a negative gain keeps its sign and pixel size");
  assert.deepEqual(gain({}, { scaleX: .08, scaleY: .12 }, { width: 124, height: 78 }, 124, 78), [.12, [.08 / .12, 1]], "per-axis optical gain remains unchanged");
  assert.equal(LIQUID_GLASS_MATERIAL.chromaAmount, .55);
  assert.match(componentSource, /SEGMENTED_TRAVEL_SPRING = \{ mass: 1, stiffness: 260, damping: 28 \}/);
  assert.match(componentSource, /SEGMENTED_HOLD_IMPACT_SCRIPT = \{\s*stiffness: 360,\s*damping: 24,\s*impulse: -1\.6,/s);
});

test("a pressed tab bar grows about its centre and its glass stays registered", () => {
  const segmented = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassSegmented.tsx", import.meta.url), "utf8");
  const source = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/source.ts", import.meta.url), "utf8");
  const surface = readFileSync(new URL("../packages/react-liquid-glass/src/controls/GlassSurface.tsx", import.meta.url), "utf8");
  // iOS 27 grows the whole bar, tabs and all, 3.5% while a finger is down: 7pt a side on its
  // 399pt bar, which wider bars do not exceed. It grows on press and returns on release.
  assert.match(segmented, /const PRESS_SCALE = 1\.035;\s*const PRESS_OUTSET = 7;/);
  assert.match(segmented, /springTo\(barScale, pressed && width \? 1 \+ Math\.min\(PRESS_SCALE - 1, PRESS_OUTSET \* 2 \/ width\) : 1, SEGMENTED_PRESS_SPRING\)/);
  assert.match(segmented, /interactionStop\.current = springTo\(interaction, 1, SEGMENTED_PRESS_SPRING\);\s*pressBar\(true\);/);
  assert.match(segmented, /const releaseInteraction = \(delay = 0, settle = true\) => \{\s*setDragging\(false\);\s*pressBar\(false\);/);
  assert.match(segmented, /<motion\.div ref=\{rootRef\} style=\{\{ scale: barScale \}\}/);
  // The lens is laid out in the bar's own pixels: fractions of its padded frame on screen, and
  // sizes divided by the bar's current scale.
  assert.match(segmented, /const rect = root\.getBoundingClientRect\(\), scale = liquidScreenScale\(root, rect\);/);
  assert.equal((segmented.match(/= paddedFrame\(/g) ?? []).length, 4, "every frame reading goes through the scale-aware frame");
  assert.doesNotMatch(segmented, /rootRect\.left - SEGMENTED_PAD_X|rootRect\.width \+ SEGMENTED_PAD_X \* 2/);
  assert.match(segmented, /const halfW = itemRect\.width \/ 2 \/ expanded\.scale\.x, halfH = itemRect\.height \/ 2 \/ expanded\.scale\.y;/);
  assert.equal((segmented.match(/impactWidth\.current = expanded\.width \/ expanded\.scale\.x;/g) ?? []).length, 2);
  // Glass under a scaled ancestor samples what lies behind it on screen and keeps its ink in place.
  assert.match(source, /export function liquidScreenScale\(element: HTMLElement, rect: Pick<DOMRect, "width" \| "height"> = element\.getBoundingClientRect\(\)\) \{\s*const width = element\.offsetWidth, height = element\.offsetHeight;\s*const ratio = \(screen: number, layout: number\) => layout > 0 && Math\.abs\(screen - layout\) >= 1 \? screen \/ layout : 1;/);
  assert.equal((source.match(/const rect = local\((?:element|range|svg)\.getBoundingClientRect\(\)\);/g) ?? []).length, 3);
  assert.match(liquidAdapterSource, /return \{ left: rect\.left - bleed \* scale\.x, top: rect\.top - bleed \* scale\.y, width: \(sizeRef\.current\.width \+ bleed \* 2\) \* scale\.x, height: \(sizeRef\.current\.height \+ bleed \* 2\) \* scale\.y \};/);
  // That backdrop is larger than the glass's own pixels while scaled, so the glass takes its share
  // by proportion: fixed pixels shifted everything seen through a held lens down and to the right.
  assert.match(liquidAdapterSource, /const sx = backdrop\.width \/ \(width \+ bleed \* 2\), sy = backdrop\.height \/ \(height \+ bleed \* 2\);\s*ctx\.drawImage\(backdrop, bleed \* sx, bleed \* sy, width \* sx, height \* sy, 0, 0, width, height\);/);
  assert.doesNotMatch(liquidAdapterSource, /drawImage\(backdropRef\.current, bleed \* 2, bleed \* 2, width \* 2, height \* 2/);
  assert.match(surface, /return \{ left: rect\.left - 40 \* scale\.x, top: rect\.top - 40 \* scale\.y, width: \(element\.offsetWidth \+ 80\) \* scale\.x, height: \(element\.offsetHeight \+ 80\) \* scale\.y \};/);
  // Scrollers that hold tab bars leave 16px a side, so the grown bar and its lifted lens are never cut.
  assert.match(pageStylesSource, /\.filter-scroll \{ margin: -18px -16px; \}/);
  assert.match(pageStylesSource, /\.filter-scroll > \.dg-scroll-area__viewport > div > \.dg-scroll-area__content \{ padding: 18px 16px; overflow: clip; \}/);
  assert.match(pageStylesSource, /\.preset-list \{ margin: 6px -16px 10px; \}/);
  // Scaled screen boxes map back to the element's own pixels; whole-pixel rounding is no scale,
  // and a compact side that agrees with the other side's scale takes it.
  const scaleOf = new Function(`${stripTypeScriptTypes(source.slice(source.indexOf("export function liquidScreenScale"), source.indexOf("\n}\n", source.indexOf("export function liquidScreenScale")) + 2)).replace("export function", "function")}\nreturn liquidScreenScale;`)();
  assert.deepEqual(scaleOf({ offsetWidth: 211, offsetHeight: 40 }, { width: 211.16, height: 40 }), { x: 1, y: 1 });
  assert.deepEqual(scaleOf({ offsetWidth: 211, offsetHeight: 40 }, { width: 211 * 1.035, height: 40 * 1.035 }), { x: 1.035, y: 1.035 });
  assert.deepEqual(scaleOf({ offsetWidth: 0, offsetHeight: 0 }, { width: 10, height: 10 }), { x: 1, y: 1 });
  assert.deepEqual(scaleOf({ offsetWidth: 100, offsetHeight: 34 }, { width: 102.5, height: 34.85 }), { x: 1.025, y: 1.025 }, "a 34px side under scale(1.025) changes by 0.85px");
  assert.deepEqual(scaleOf({ offsetWidth: 211, offsetHeight: 40 }, { width: 212.5, height: 40.28 }), { x: 212.5 / 211, y: 212.5 / 211 }, "early in the press spring");
  assert.deepEqual(scaleOf({ offsetWidth: 100, offsetHeight: 34 }, { width: 110, height: 34 }), { x: 1.1, y: 1 }, "a horizontal-only scale stays horizontal");
});

test("ordinary glass resolves defaults < instance < provider without freezing animated values", () => {
  const read = (path, name) => {
    const source = readFileSync(new URL(`../packages/react-liquid-glass/src/${path}`, import.meta.url), "utf8");
    const start = source.indexOf(`export function ${name}`);
    return stripTypeScriptTypes(source.slice(start, source.indexOf("\n}\n", start) + 2)).replace("export function", "function");
  };
  const isMotionValue = new Function(`${read("shared/values.ts", "isMotionValue")}\nreturn isMotionValue;`)();
  const resolve = new Function("DEFAULT_MATERIAL", "isMotionValue", `${read("liquid-glass/provider.tsx", "resolveGlassMaterial")}\nreturn resolveGlassMaterial;`)(
    { chromaAmount: .33, domeDepth: 28 }, isMotionValue);
  assert.deepEqual(resolve({}, {}), { chromaAmount: .33, domeDepth: 28 }, "shared defaults fill missing values");
  assert.equal(resolve({ domeDepth: 18 }, {}).domeDepth, 18, "an instance value beats the shared default");
  assert.equal(resolve({ domeDepth: 18 }, { domeDepth: 40 }).domeDepth, 40, "explicit provider material beats the instance");
  const blur = motionValue(.5);
  assert.equal(resolve({ blurStrength: blur }, { blurStrength: 2 }).blurStrength, blur, "a provider constant never freezes an animated value");
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


test("HDR light is soft-capped and identical on both backends", () => {
  const wgsl = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/shaders/glass.wgsl", import.meta.url), "utf8");
  const presenter = readFileSync(new URL("../packages/react-liquid-glass/src/liquid-glass/highlight-hdr.ts", import.meta.url), "utf8");
  const curve = source => {
    const match = source.match(/(0?\.\d+) \* tanh\(\(light\.r \* (0?\.\d+) \+ light\.g \* (0?\.\d+)\) \/ (0?\.\d+)\)[\s\S]*?light\.r \* (0?\.\d+) \+ light\.g \* (0?\.\d+)\)/);
    assert.ok(match, "HDR light curve missing");
    return match.slice(1).map(Number);
  };
  const [cap, contact, rim, knee, contactAlpha, rimAlpha] = curve(wgsl);
  assert.deepEqual(curve(presenter), [cap, contact, rim, knee, contactAlpha, rimAlpha], "WebGPU and WebGL2 present the same HDR light");
  // Composite over SDR white: lift + base * (1 - alpha).
  const peak = (r, g) => cap * Math.tanh((r * contact + g * rim) / knee) + 1 - r * contactAlpha - g * rimAlpha;
  assert.ok(peak(.92, 0) < 1.5, "a full press stays near 1.5x SDR white");
  assert.ok(peak(1, 1) < 1 + cap, "overlapping contact and rim light never stack past the cap");
  assert.ok(peak(0, .26) > 1.15, "the static rim still rises above SDR white");
});

test("shared motion values notify until unsubscribed", () => {
  const value = motionValue(1);
  let observed = 0;
  const unsubscribe = value.on("change", (next) => { observed = next; });
  value.set(2);
  unsubscribe();
  assert.equal(observed, 2);
});
