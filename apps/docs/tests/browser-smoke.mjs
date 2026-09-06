// Run in the docs site's browser console (or through its CDP session):
// const qa = await import('/@fs/<repo>/apps/docs/tests/browser-smoke.mjs');
// await qa.checkCatalog(); await qa.checkInteractions(); await qa.checkPlayground();
// This uses the real React app and WebGL canvases, without a mock DOM or test framework.
import { catalog, componentAliases } from '../src/site/catalog.ts';
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (predicate, message, timeout = 5000) => {
  const start = performance.now();
  while (!predicate()) { if (performance.now() - start > timeout) throw new Error(message); await new Promise(resolve => setTimeout(resolve, 16)); }
};
const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const go = async path => {
  history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0);
  await until(() => location.pathname === path.split('?')[0], `Navigation failed: ${path}`); await paint();
};
const click = (selector, parent = document) => { const element = parent.querySelector(selector); assert(element, `Missing ${selector}`); element.focus({ preventScroll: true }); element.click(); return element; };
const input = (element, value) => { assert(element, 'Input missing'); Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); };
export async function checkCatalog() {
  const passed = [];
  await go('/components');
  await until(() => document.querySelector('.search-field canvas')?.width > 0, 'Catalog optics did not mount');
  assert(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Optical padding enlarged the catalog viewport');
  for (const entry of catalog) {
    await go(`/components/${entry.id}`);
    await until(() => document.querySelector('main h1')?.textContent === entry.name, `Missing page for ${entry.id}`);
    assert(document.querySelector('.component-preview'), `Missing preview: ${entry.id}`);
    assert(document.querySelector('pre code')?.textContent.includes(entry.api), `Missing usage: ${entry.id}`);
    assert(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, `Horizontal overflow: ${entry.id}`);
    assert(document.querySelectorAll('table tbody tr').length === entry.props.length, `Incomplete API: ${entry.id}`);
    passed.push(entry.id);
  }
  return { pages: passed.length, passed };
}
export async function checkInteractions() {
  const passed = [];
  await go('/components/button'); click('.component-preview .dg-button'); await paint(); assert(document.querySelector('.component-preview')?.textContent.includes('Clicked 1'), 'Button did not fire'); passed.push('button');
  await go('/components/switch'); const toggle = click('.dg-switch input'); await paint(); assert(toggle.checked, 'Switch failed'); passed.push('switch');
  await go('/components/slider'); input(document.querySelector('.dg-slider input'), '72'); await paint(); assert(document.querySelector('.example-status')?.textContent === '72%', 'Slider did not update'); passed.push('slider');
  await go('/components/tabs'); click('[role="tab"]:nth-of-type(3)'); await paint(); assert(document.querySelector('[role="tab"]:nth-of-type(3)')?.getAttribute('aria-selected') === 'true', 'Tabs selection did not update'); assert(!document.querySelector('[role="tabpanel"]'), 'Tabs demo should only show the control'); passed.push('tabs');
  await go('/components/input'); input(document.querySelector('.component-preview .dg-field input'), 'Glass test'); await paint(); assert(document.querySelector('.example-status')?.textContent.includes('Glass test'), 'Input failed'); passed.push('input');
  await go('/components/checkbox'); assert(click('.dg-choice input').checked, 'Checkbox failed'); passed.push('checkbox');
  await go('/components/radio-group'); const radio = click('input[value="motion"]'); await paint(); assert(radio.checked && !document.querySelector('input[value="design"]').checked, 'Radio group failed'); passed.push('radio');
  await go('/components/dialog'); const trigger = click('.component-preview > .dg-stage__contents > .dg-button'); await until(() => document.querySelector('.component-preview dialog')?.open, 'Dialog did not open'); assert(document.querySelector('.component-preview dialog').contains(document.activeElement), 'Dialog did not receive focus'); click('.component-preview dialog .dg-dismiss'); await until(() => !document.querySelector('.component-preview dialog')?.open, 'Dialog did not close'); assert(document.activeElement === trigger, 'Dialog did not restore focus'); passed.push('dialog');
  await go('/components/dropdown-menu'); click('.dg-popover-anchor button'); await until(() => document.querySelector('.dg-popover-layer')?.matches(':popover-open'), 'Popover did not open'); await until(() => document.activeElement?.getAttribute('role') === 'menuitem', 'Menu focus missing'); const menu = document.querySelector('.dg-dropdown'); menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); assert(document.activeElement?.textContent === 'Reset', 'Arrow navigation failed'); click('[role="menuitem"]', menu); await until(() => !document.querySelector('.dg-popover-layer')?.matches(':popover-open'), 'Menu did not close'); assert(document.querySelector('.example-status')?.textContent.includes('1 copies'), 'Menu action did not fire'); passed.push('dropdown');
  await go('/components/accordion'); click('.dg-accordion__heading button'); await until(() => document.querySelector('.dg-accordion [role=region]')?.getBoundingClientRect().height > 20, 'Accordion did not expand'); assert(document.querySelector('.dg-accordion__heading button')?.getAttribute('aria-expanded') === 'true', 'Accordion failed'); passed.push('accordion');
  await go('/components/toast'); click('.component-preview .dg-button'); await paint(); assert(document.querySelector('.dg-toast')?.textContent.includes('saved'), 'Toast missing'); click('.dg-toast .dg-dismiss'); await until(() => !document.querySelector('.dg-toast')?.textContent, 'Toast did not dismiss'); passed.push('toast');
  await go('/components/video'); await until(() => document.querySelector('.dg-video-player canvas')?.style.opacity === '1', 'Paused video did not render its first frame'); assert(document.querySelector('video')?.paused, 'Video autoplayed unexpectedly'); passed.push('paused video');
  return { interactions: passed.length, passed };
}
export async function checkPlayground() {
  await go('/playground?component=button');
  await until(() => document.querySelector('.material-inspector'), 'Playground missing');
  const range = document.querySelector('input[aria-label="Dispersion"]'); input(range, '1.1'); await paint();
  assert(document.querySelector('.playground-code code')?.textContent.includes('1.1'), 'Material code did not update');
  assert(JSON.parse(localStorage.getItem('glass-playground')).chromaAmount === 1.1, 'Material did not persist');
  const fields = document.querySelectorAll('.material-field').length;
  assert(fields === 11, 'Advanced controls mounted eagerly');
  click('.material-advanced .dg-accordion__heading button'); await paint(); assert(document.querySelectorAll('.material-field').length === 21, 'Advanced fields incomplete');
  click('.material-advanced .debug-field input'); await paint(); assert(document.querySelector('.playground-code code')?.textContent.includes('"debug": true'), 'Optical field is not connected');
  click('button[aria-label="Reset material"]'); await paint(); assert(localStorage.getItem('glass-playground') === '{}', 'Reset failed');
  return { material: 'live, persisted, reset', parameters: 21, debug: true };
}

export async function checkRefinements() {
  const passed = [];
  await go('/components/select');
  const selectTrigger = click('.dg-select button[role="combobox"]');
  await until(() => document.activeElement?.getAttribute('role') === 'option', 'Select focus missing');
  assert(document.querySelector('.dg-popover-layer:popover-open'), 'Select must use native popover');
  click('.dg-select-options button:nth-of-type(2)');
  await until(() => !document.querySelector('.dg-popover-layer:popover-open'), 'Select exit missing');
  assert(document.querySelector('.dg-native-select').value === 'motion', 'Native form value was not updated');
  assert(selectTrigger.textContent.includes('Motion'), 'Select label did not update');
  assert(document.activeElement === selectTrigger, 'Select focus not restored');
  passed.push('select value, native popover, exit, focus');
  await go('/components/accordion');
  const headers = document.querySelectorAll('.dg-accordion__heading button');
  headers[0].click();
  await until(() => document.querySelector('.dg-accordion [role="region"]').getBoundingClientRect().height > 20, 'Accordion expansion failed');
  const region = document.querySelector('.dg-accordion [role="region"]');
  assert(region.closest('.dg-surface') === headers[0].closest('.dg-surface'), 'Accordion body is outside its glass');
  headers[1].click(); await until(() => region.getBoundingClientRect().height < 1, 'Exclusive accordion did not collapse');
  assert(region.inert, 'Closed accordion contents remain focusable');
  passed.push('accordion animation, containment, exclusive state');
  await go('/components/tooltip');
  const tooltipTrigger = document.querySelector('.component-preview button'); tooltipTrigger.focus();
  await until(() => document.querySelector('.dg-popover-layer:popover-open'), 'Tooltip did not use popover');
  document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  assert(document.querySelector('.dg-popover-layer:popover-open'), 'Tooltip skipped exit animation');
  await until(() => !document.querySelector('.dg-popover-layer:popover-open'), 'Tooltip exit did not finish');
  passed.push('tooltip focus, escape, animated exit');
  await go('/components/tabs');
  assert(document.querySelector('.dg-tabs__container canvas'), 'Tabs container has no glass renderer');
  passed.push('tabs glass container');
  await go('/components');
  click('.catalog-material .dg-popover-anchor > button');
  await until(() => document.querySelector('.catalog-material .dg-popover-layer:popover-open'), 'Catalog material panel missing');
  const panel = document.querySelector('.catalog-material');
  click('button[aria-label="Reset material"]', panel); await paint();
  assert(localStorage.getItem('glass-catalog-material') === '{}', 'Catalog reset did not restore per-control defaults');
  input(panel.querySelector('input[aria-label="Tint"]'), '0.2'); await paint();
  assert(JSON.parse(localStorage.getItem('glass-catalog-material')).tintStrength === .2, 'Catalog material not connected');
  assert(panel.querySelector('.dg-popover-anchor > button').textContent.includes('Custom'), 'Catalog custom state missing');
  click('button[aria-label="Reset material"]', panel); await paint();
  assert(panel.querySelector('.dg-popover-anchor > button').textContent.includes('Default'), 'Catalog default state missing');
  passed.push('floating catalog material, live override, reset');
  await go('/playground?component=slider&material='+encodeURIComponent(JSON.stringify({tintStrength:.1,pixelRatio:.5})));
  await until(() => document.querySelector('.dg-slider canvas')?.width > 0, 'Slider renderer missing');
  await paint();
  const canvas = document.querySelector('.dg-slider canvas'), rect = canvas.getBoundingClientRect();
  assert(canvas.width >= rect.width * 1.99, 'Global resolution blurred the control');
  const pixel = canvas.getContext('2d').getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
  assert(pixel[0] > 250 && pixel[1] > 250 && pixel[2] > 250 && pixel[3] === 255, 'Material overrides destroyed the opaque rest thumb');
  click('button[aria-label="Reset material"]');
  passed.push('slider 2x sampling and opaque rest under global overrides');
  return { refinements: passed.length, passed };
}

export async function checkPopupRetargeting() {
  await go('/components/dropdown-menu');
  await until(() => document.querySelector('.dg-popover-anchor canvas')?.width > 0, 'Trigger optics missing');
  const trigger = document.querySelector('.dg-popover-anchor > button');
  const canvas = document.querySelector('.dg-popover-anchor canvas');
  for (let i = 0; i < 6; i++) {
    trigger.click(); await new Promise(resolve => setTimeout(resolve, 55));
    const panel = document.querySelector('.dg-popover__panel'), rect = panel.getBoundingClientRect();
    assert(Number.isFinite(rect.width + rect.height) && rect.width <= panel.offsetWidth * 1.1 && rect.height <= panel.offsetHeight * 1.1, 'Reversal ballooned the contour');
    assert(document.querySelector('.dg-popover-layer canvas') === canvas, 'Fusion switched renderer during retargeting');
  }
  await until(() => !document.querySelector('.dg-popover-layer:popover-open'), 'Reversal did not settle closed');
  assert(document.querySelector('.dg-popover-anchor canvas') === canvas, 'Trigger lost its original compositor');
  assert(document.activeElement === trigger, 'Reversal lost focus restoration');
  return { reversals: 6, compositor: 'same canvas throughout', closed: true };
}

export async function checkSiteControls() {
  await go('/components');
  for (const selector of ['.wordmark', '.header-tools', '.docs-sidebar', '.component-tile__label', '.site-footer']) {
    assert(!document.querySelector(`${selector} canvas`), `${selector} must stay free of decorative glass`);
  }
  const search = document.querySelector('input[aria-label="Search components"]');
  assert(search.closest('.dg-surface')?.querySelector('canvas'), 'Catalog search must use the library glass surface');
  input(search, 'button group'); await paint();
  assert(document.querySelectorAll('.component-tile').length === 1, 'Glass search did not filter the catalog');
  click('.component-tile__label'); await until(() => document.querySelector('main h1')?.textContent === 'Button Group', 'Glass link did not navigate');
  const group = document.querySelector('.component-preview .dg-button-group');
  await until(() => group.querySelector('canvas')?.width > 0, 'Button group has no optics');
  assert(group.querySelectorAll('canvas').length === 1, 'Joined buttons must share one optical body');
  const buttons = [...group.querySelectorAll('button')];
  buttons[2].click(); await paint(); assert(buttons[1].textContent === '125%', 'Grouped action failed');
  buttons[1].click(); await paint(); assert(buttons[1].textContent === '100%', 'Grouped reset failed');
  for (let i = 0; i < 3; i++) { buttons[0].click(); await paint(); }
  assert(buttons[0].disabled, 'Lower bound did not disable zoom out');
  const key = value => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  buttons[2].focus(); key('Home'); assert(document.activeElement === buttons[1], 'Home did not skip disabled action');
  key('ArrowRight'); assert(document.activeElement === buttons[2], 'Arrow focus failed');
  key('ArrowRight'); assert(document.activeElement === buttons[1], 'Arrow focus did not wrap');
  group.dir = 'rtl'; key('ArrowLeft'); assert(document.activeElement === buttons[2], 'RTL focus failed'); group.removeAttribute('dir');
  const vertical = document.querySelector('.component-preview [data-orientation="vertical"]');
  const choices = vertical.querySelectorAll('button'); choices[0].focus(); key('ArrowDown'); assert(document.activeElement === choices[1], 'Vertical focus failed');
  assert(choices[0].getAttribute('aria-pressed') === 'true', 'Focus must not fire an action');
  choices[1].click(); await paint(); assert(choices[1].getAttribute('aria-pressed') === 'true', 'Grouped toggle did not activate');

  await go('/playground?component=button-group');
  const select = click('.playground-toolbar [role="combobox"]');
  await until(() => document.querySelector('.playground-toolbar .dg-popover-layer:popover-open'), 'Playground select must use liquid popover');
  const option = [...document.querySelectorAll('.playground-toolbar [role="option"]')].find(item => item.textContent === 'Slider');
  option.click(); await until(() => document.querySelector('.playground-single .component-preview--slider'), 'Playground component selection failed');
  await until(() => !document.querySelector('.playground-toolbar .dg-popover-layer:popover-open'), 'Playground select did not close');
  assert(document.activeElement === select, 'Playground select lost focus');
  const inspector = document.querySelector('.material-inspector');
  assert(inspector.querySelectorAll('.dg-slider').length === 11, 'Parameter panel must use small glass sliders lazily');
  click('.material-advanced .dg-accordion__heading button');
  await until(() => inspector.querySelectorAll('.dg-slider').length === 21, 'Advanced glass sliders missing');
  const close = click('.material-advanced .dg-accordion__heading button');
  await paint(); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) assert(inspector.querySelectorAll('.dg-slider').length === 21, 'Advanced sliders unmounted before closing animation');
  await until(() => inspector.querySelectorAll('.dg-slider').length === 11, 'Advanced sliders did not release resources');
  assert(close.getAttribute('aria-expanded') === 'false', 'Advanced disclosure state incorrect');
  return { search: true, navigation: true, buttonGroup: 'one canvas, actions, disabled, horizontal/vertical/RTL focus', playground: 'liquid select, 21 glass sliders, lazy release' };
}

export async function checkPopupPolish() {
  await go('/components/dropdown-menu');
  const trigger = click('.component-preview .dg-popover-anchor > button');
  await until(() => document.querySelector('.component-preview .dg-popover-layer:popover-open'), 'Menu failed to open');
  const panel = document.querySelector('.component-preview .dg-popover__panel');
  assert(panel.contains(document.activeElement), 'Opening snapshot must include the focused menu item');
  const nextItem = panel.querySelectorAll('[role="menuitem"]')[1];
  nextItem.focus();
  await until(() => getComputedStyle(panel).opacity === '1', 'Native menu did not return');
  assert(document.activeElement === nextItem, 'Focus changed when opening returned to native content');
  const { paintLiquidMenuContent } = await import('../../../packages/react-liquid-glass/src/liquid-glass/menu-content.ts');
  const ink = document.createElement('canvas');
  assert(paintLiquidMenuContent(panel, ink), 'Menu capture failed');
  const disabled = panel.querySelector('button:disabled').getBoundingClientRect(), bounds = panel.getBoundingClientRect();
  // Sample inside the row; the preceding item's focus outline can cross its outer edge.
  const pixels = ink.getContext('2d').getImageData(Math.ceil((disabled.left - bounds.left) * 2) + 8, Math.ceil((disabled.top - bounds.top) * 2) + 8, Math.floor(disabled.width * 2) - 16, Math.floor(disabled.height * 2) - 16).data;
  let maxAlpha = 0;
  for (let i = 3; i < pixels.length; i += 4) maxAlpha = Math.max(maxAlpha, pixels[i]);
  assert(maxAlpha > 70 && maxAlpha <= 103, 'Captured disabled text must preserve native 40% opacity');
  const canvas = document.querySelector('.component-preview .dg-popover-layer canvas');
  const width = canvas.width, height = canvas.height;
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  await until(() => !document.querySelector('.component-preview .dg-popover-layer:popover-open'), 'Closing did not finish');
  await paint();
  assert(document.querySelector('.component-preview .dg-popover-anchor canvas') === canvas, 'Closing replaced the compositor');
  assert(canvas.width === width && canvas.height === height, 'Closing resized the displayed bitmap and caused a flash');
  assert(getComputedStyle(trigger.querySelector('.dg-surface__content')).opacity === '1', 'Trigger ink was not restored with the canvas');

  await go('/components');
  click('.catalog-material .dg-popover-anchor > button');
  await until(() => document.querySelector('.catalog-material .dg-popover-layer:popover-open'), 'Material panel failed to open');
  const original = document.querySelector('.catalog-material .dg-popover-anchor > button'), mirror = document.querySelector('.catalog-material .dg-popover__trigger-ink button');
  const originals = [original, ...original.querySelectorAll('.dg-surface__content > *')], copies = [mirror, ...mirror.querySelectorAll('.dg-surface__content > *')];
  originals.forEach((element, i) => {
    assert(getComputedStyle(element).fontSize === getComputedStyle(copies[i]).fontSize, 'Top-layer trigger changed font size');
    const a=element.getBoundingClientRect(), b=copies[i].getBoundingClientRect();
    assert(Math.abs(a.x-b.x)<.1 && Math.abs(a.y-b.y)<.1 && Math.abs(a.width-b.width)<.1, 'Top-layer trigger moved its text/icon layout');
  });
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  await until(() => !document.querySelector('.catalog-material .dg-popover-layer:popover-open'), 'Material panel did not close');

  await go('/components/select');
  assert(document.querySelector('.dg-select button svg.lucide-chevron-down'), 'Select trigger must use Lucide ChevronDown');
  click('.dg-select button');
  await until(() => document.querySelector('.dg-select-options svg.lucide-check'), 'Select options must use Lucide Check');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  return {capturedDisabledOpacity: maxAlpha, popupFrame: 'stable through closing', triggerTypography: 'identical', selectIcons: 'Lucide'};
}

// Self-contained so the same check can also run against a production build.
export async function checkSwitchThemes() {
  const toggle = document.querySelector('.header-tools .icon-button:not(.mobile-menu-button)');
  const input = document.querySelector('.component-preview .dg-switch input');
  if (!toggle || !input) throw new Error('Open the Switch component page first');
  const originalTheme = document.documentElement.dataset.theme, originalChecked = input.checked;
  const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const result = [];
  try {
    for (const theme of ['light', 'dark']) {
      if (document.documentElement.dataset.theme !== theme) toggle.click();
      await paint();
      for (const checked of [false, true]) {
        if (input.checked !== checked) input.click();
        const start = performance.now();
        while (Math.abs(Number(getComputedStyle(input.closest('.dg-switch')).getPropertyValue('--dg-switch-progress')) - Number(checked)) > .001) {
          if (performance.now() - start > 2000) throw new Error('Switch did not settle');
          await paint();
        }
        const color = getComputedStyle(document.querySelector('.dg-switch__track')).backgroundColor;
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') throw new Error(`Missing ${theme} ${checked ? 'on' : 'off'} track`);
        result.push({theme,checked,color});
      }
    }
  } finally {
    if (input.checked !== originalChecked) input.click();
    if (document.documentElement.dataset.theme !== originalTheme) toggle.click();
    await paint();
  }
  return result;
}

export async function checkContactFeedback() {
  await go('/components/button');
  const button = document.querySelector('.component-preview .dg-button'), surface = button.querySelector('[data-dg-contact]');
  const canvas = surface.querySelector('canvas'), ink = surface.querySelector('.dg-surface__content');
  const rect = surface.getBoundingClientRect(), sx = rect.left + rect.width * .84, sy = rect.top + rect.height / 2;
  await until(() => canvas.width === (surface.offsetWidth + 80) * 2, 'Contact canvas has not rendered its first frame');
  await paint();
  const color = () => {
    const data = canvas.getContext('2d').getImageData(Math.round((40 + rect.width * .84) * 2), Math.round((40 + rect.height / 2) * 2), 1, 1).data;
    return (data[0] + data[1] + data[2]) / 3;
  };
  const before = color(), label = button.textContent;
  const pointer = (target, type, x = sx, y = sy) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 27, isPrimary: true, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y }));
  pointer(ink, 'pointerdown');
  await until(() => color() > before + 8, 'The actual grip position did not illuminate');
  pointer(window, 'pointermove', sx + 90, sy - 30); await paint();
  const pulled = new DOMMatrix(getComputedStyle(ink).transform);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) assert(pulled.m41 > .1 && pulled.m41 < 3 && pulled.m42 < 0 && Math.abs(pulled.b) < .05, 'The material must follow a subtle resisted pull');
  pointer(window, 'pointerup', sx + 90, sy - 30);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  assert(button.textContent === label, 'Dragging accidentally fired the action');
  await until(() => { const m = new DOMMatrix(getComputedStyle(ink).transform); return Math.abs(m.a - 1) < .001 && Math.abs(m.m41) < .02 && Math.abs(m.m42) < .02; }, 'The contact did not spring back');
  await until(() => Math.abs(color() - before) < 2, 'Contact light changed the resting material');
  // The original grip fixes the material; the light must follow a different live pointer position.
  const left = rect.left + rect.width * .2;
  const pixelAt = x => { const p = canvas.getContext('2d').getImageData(Math.round((40 + x) * 2), Math.round((40 + rect.height / 2) * 2), 1, 1).data; return (p[0] + p[1] + p[2]) / 3; };
  pointer(ink, 'pointerdown', left, sy); await new Promise(resolve => setTimeout(resolve, 160));
  const litLeft = pixelAt(rect.width * .2);
  pointer(window, 'pointermove', rect.left + rect.width * .8, sy); await paint();
  assert(pixelAt(rect.width * .8) > pixelAt(rect.width * .2) + 8 && pixelAt(rect.width * .2) < litLeft - 5, 'The contact light stayed at the original grip');
  pointer(window, 'pointerup');
  pointer(ink, 'pointerdown'); pointer(window, 'lostpointercapture');
  assert(!surface.hasAttribute('data-dg-contact-active'), 'Lost capture left the material pinned');
  pointer(ink, 'pointerdown'); window.dispatchEvent(new Event('blur'));
  assert(!surface.hasAttribute('data-dg-contact-active'), 'Window blur left the material pinned');
  return { light: 'follows the pointer', pull: 'subtle, anchored, elastic', cancellation: 'capture loss and blur', rest: 'unchanged' };
}

async function captureLiquidCanvas(canvas) {
  const {subscribeLiquidFrames} = await import('refractive-glass-react/liquid-glass/renderer');
  const snapshot = document.createElement('canvas'); snapshot.width = snapshot.height = 0;
  const stop = subscribeLiquidFrames(target => {
    if(target !== canvas) return;
    snapshot.width = canvas.width; snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas,0,0);
  });
  window.dispatchEvent(new Event('resize'));
  try { await until(()=>snapshot.width>1, 'Glass did not publish a rendered frame'); }
  catch(error) { stop(); throw error; }
  return {snapshot,stop};
}

export async function checkSharedBackdrops() {
  const passed = [];
  for (const id of ['button', 'button-group', 'input', 'textarea', 'tabs', 'select', 'morph-menu']) {
    await go(`/components/${id}`);
    const stage = document.querySelector('.component-preview'), substrate = stage.querySelector('.dg-stage__substrate');
    await until(() => stage.querySelector('canvas[data-dg-renderer]')?.width > 1, `${id} did not render`);
    const captured = await captureLiquidCanvas(stage.querySelector('canvas[data-dg-renderer]'));
    const spacer = document.createElement('div');
    const hasColor = channel => {
      const {width,height} = captured.snapshot, data = captured.snapshot.getContext('2d').getImageData(0,0,width,height).data;
      let pixels = 0;
      for(let i=0;i<data.length;i+=4) if(data[i+3]>200 && data[i+channel]>data[i+(1-channel)]+40 && data[i+channel]>data[i+2]+30) pixels++;
      return pixels>50;
    };
    try {
      substrate.style.display='none'; stage.style.backgroundColor='rgb(25, 190, 65)';
      await until(()=>hasColor(1),`${id} retained the hidden substrate`);
      if(id==='button') { spacer.style.height='200vh';document.body.append(spacer);window.scrollTo({top:document.body.scrollHeight,behavior:'instant'});await paint(); }
      substrate.remove(); stage.style.backgroundColor='rgb(205, 35, 55)';
      if(id==='button') { await paint();window.scrollTo({top:0,behavior:'instant'}); }
      await until(()=>hasColor(0),`${id} retained the removed substrate`);
      passed.push(id);
    } finally { captured.stop();spacer.remove();substrate.style.display='';stage.prepend(substrate);stage.style.backgroundColor=''; }
  }
  await go('/components/button');
  const {subscribeLiquidFrames}=await import('refractive-glass-react/liquid-glass/renderer');
  await new Promise(resolve=>setTimeout(resolve,600));
  let frames=0;const stop=subscribeLiquidFrames(()=>frames++);
  try { await new Promise(resolve=>setTimeout(resolve,250));assert(frames===0,`Backdrop feedback keeps rendering at rest: ${frames}`); }
  finally { stop(); }
  return {backdrops:passed,hiddenAndRemoved:'live page pixels',idleFrames:frames};
}

export async function checkFieldAndGroupPolish() {
  for(const id of ['input','textarea']) {
    await go(`/components/${id}`);
    const field=document.querySelector(`.component-preview ${id}`),surface=field.closest('.dg-surface');
    const appearance=element=>{const s=getComputedStyle(element);return [s.boxShadow,s.borderWidth,s.outlineWidth,s.outlineStyle].join('|')};
    field.blur();const before=[appearance(field),appearance(surface)];field.focus();await paint();
    assert(before.join(';')===[appearance(field),appearance(surface)].join(';'),`${id} changed its focus shadow or border`);
    if(id==='textarea')assert(getComputedStyle(field).resize==='none','Textarea still has a resize handle');
  }
  await go('/components/button-group');
  for(const group of document.querySelectorAll('.component-preview .dg-button-group')) {
    const outer=parseFloat(getComputedStyle(group.querySelector('.dg-surface')).borderRadius),padding=parseFloat(getComputedStyle(group.querySelector('.dg-button-group__items')).paddingTop);
    for(const inner of group.querySelectorAll('.dg-button > .dg-surface'))assert(parseFloat(getComputedStyle(inner).borderRadius)===outer-padding,'Button group radii do not follow the container inset');
  }
  return {fields:'stable focus',textarea:'no resizer',buttonGroup:'concentric corners'};
}

export async function checkSelectOcclusion() {
  await go('/playground');
  const inspector=document.querySelector('.playground-inspector'),inspectorBox=inspector.getBoundingClientRect(),opticsBox=inspector.querySelector('.dg-surface__optics').getBoundingClientRect();
  assert(Math.abs(opticsBox.left-inspectorBox.left+40)<1 && Math.abs(opticsBox.top-inspectorBox.top+40)<1,'Mobile inspector glass escaped its containing block');
  const trigger=document.querySelector('.playground-controls [role="combobox"]') ?? document.querySelector('main [role="combobox"]');
  trigger.click();const layer=trigger.closest('.dg-popover-anchor').nextElementSibling;
  await until(()=>layer.matches(':popover-open'),'Component Select did not open');
  await new Promise(resolve=>setTimeout(resolve,500));
  try {
    const mirror=layer.querySelector('.dg-popover__trigger-ink'),rect=mirror.getBoundingClientRect();
    const clip=getComputedStyle(mirror).clipPath.match(/^path\(evenodd, "(.+)"\)$/);
    assert(clip,'Trigger ink has no panel occlusion mask');
    const ctx=document.createElement('canvas').getContext('2d'),path=new Path2D(clip[1]);
    assert(!ctx.isPointInPath(path,20,rect.height/2,'evenodd') && !ctx.isPointInPath(path,rect.width-24,rect.height/2,'evenodd'),'Trigger text or arrow paints through the expanded panel');
    return {triggerInk:'occluded by live panel geometry'};
  } finally { document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); }
}

export async function checkViewportAlignment() {
  await go('/components/button'); await go('/components');
  const trigger=document.querySelector('.catalog-material .dg-popover-anchor button');
  const layer=document.querySelector('.catalog-material .dg-popover-layer');
  trigger.click(); await until(()=>layer.matches(':popover-open'),'Material did not open');
  await new Promise(resolve=>setTimeout(resolve,500));
  const canvas=layer.querySelector('span > canvas[data-dg-renderer]');
  const before=canvas.getBoundingClientRect();
  try {
    // A nonzero fixed containing-block origin exercises the mobile viewport seam.
    layer.style.translate='23px 31px';
    visualViewport.dispatchEvent(new Event('resize')); await paint();
    const after=canvas.getBoundingClientRect(), mirror=layer.querySelector('.dg-popover__trigger-ink').getBoundingClientRect(), anchor=trigger.getBoundingClientRect();
    assert(Math.abs(after.left-before.left)<.1 && Math.abs(after.top-before.top)<.1,'The glass backdrop moved with the viewport origin');
    assert(Math.abs(mirror.left-anchor.left)<.1 && Math.abs(mirror.top-anchor.top)<.1,'The trigger ink and real trigger no longer align');
    return {viewportOrigin:'glass and ink stay aligned'};
  } finally { layer.style.translate='';window.dispatchEvent(new Event('resize'));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); }
}

export async function checkViewportBackdrop() {
  await go('/components'); click('.catalog-material .dg-popover-anchor > button');
  await until(() => document.querySelector('.catalog-material .dg-popover-layer:popover-open'), 'Material panel did not open');
  await new Promise(resolve => setTimeout(resolve, 500));
  const panel = document.querySelector('.catalog-material .dg-popover__panel'), canvas = document.querySelector('.catalog-material .dg-popover-layer > span > canvas[data-dg-renderer]');
  const captured = await captureLiquidCanvas(canvas);
  const rect = panel.getBoundingClientRect(), view = canvas.getBoundingClientRect();
  const probe = document.createElement('canvas');
  probe.width = probe.height = 80;
  probe.style.cssText = `position:fixed;pointer-events:none;left:${rect.left + 40}px;top:${rect.top + 190}px;width:80px;height:80px`;
  document.body.append(probe);
  const source = document.createElement('canvas'); source.width = source.height = 80;
  const sourceContext = source.getContext('2d');
  const {createLiquidGlassRenderer, subscribeLiquidFrames} = await import('refractive-glass-react/liquid-glass/renderer');
  const renderer = createLiquidGlassRenderer(probe, {shared:true});
  const pixel = () => captured.snapshot.getContext('2d').getImageData(Math.round((rect.left + 80 - view.left) * 2), Math.round((rect.top + 230 - view.top) * 2), 1, 1).data;
  const draw = color => { sourceContext.fillStyle=color;sourceContext.fillRect(0,0,80,80);renderer.draw({source,sourceRevision:color==='rgb(20, 200, 40)'?1:2,width:80,height:80,blobs:[]}); };
  let floating;
  let paints = 0, lastDraw = performance.now(); const stop = subscribeLiquidFrames(target => { if (target===canvas) { paints++; lastDraw=performance.now(); } });
  try {
    draw('rgb(20, 200, 40)');
    await until(()=>pixel()[1] > pixel()[0] + 70, 'The actual underlying canvas did not show through the panel');
    draw('rgb(200, 30, 50)');
    await until(()=>pixel()[0] > pixel()[1] + 70, 'A canvas-only change did not refresh the live backdrop');
    await until(()=>performance.now()-lastDraw>160, 'The backdrop never reaches rest'); const settled=paints;
    await new Promise(resolve=>setTimeout(resolve,200));
    assert(paints===settled, 'The backdrop keeps redrawing itself at rest');
    floating = document.createElement('div'); floating.popover = 'manual';
    document.body.append(floating); floating.append(probe); floating.showPopover();
    await paint();
    await until(()=>performance.now()-lastDraw>160, 'Layer change did not settle'); const outside=paints;
    for(let i=0;i<5;i++) { draw(i%2 ? 'rgb(20, 200, 40)' : 'rgb(200, 30, 50)'); await paint(); }
    assert(paints===outside, 'An excluded top-layer canvas invalidates the backdrop');
    floating.hidePopover(); document.body.append(probe); floating.remove();
    return {source:'real page pixels', canvasUpdates:true, idle:'no redraw loop', topLayer:'no feedback'};
  } finally { captured.stop();stop();renderer.dispose();probe.remove();floating?.remove();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); }
}

export async function checkPageTexture() {
  const {paintLiquidBackground} = await import('../../../packages/react-liquid-glass/src/liquid-glass/source.ts');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:-1000px;top:0;width:128px;height:96px;background:#fafaf9 repeating-linear-gradient(135deg,rgba(24,24,24,.25) 0px,rgba(24,24,24,.25) 1px,transparent 1px,transparent 12px)';
  document.body.append(probe);
  try {
    const css = getComputedStyle(probe), rect = probe.getBoundingClientRect();
    const actual = document.createElement('canvas'), expected = document.createElement('canvas');
    actual.width = expected.width = 256; actual.height = expected.height = 192;
    const ctx = actual.getContext('2d'); ctx.scale(2,2); paintLiquidBackground(probe,ctx,rect);
    const native = new Image();
    native.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 128 96"><foreignObject width="128" height="96"><div xmlns="http://www.w3.org/1999/xhtml" style="width:128px;height:96px;background:${css.backgroundColor};background-image:${css.backgroundImage}"></div></foreignObject></svg>`);
    await native.decode(); expected.getContext('2d').drawImage(native,0,0);
    const a = ctx.getImageData(0,0,256,192).data, b = expected.getContext('2d').getImageData(0,0,256,192).data;
    let error = 0; for(let i=0;i<a.length;i+=4) error += Math.abs(a[i]-b[i]);
    const mean = error / (256*192);
    assert(mean < 2, `The sampled hatch differs from native CSS (mean ${mean})`);
    assert(getComputedStyle(document.body).backgroundImage.startsWith('repeating-linear-gradient(135deg'), 'Page texture missing');
    return {nativeCssMeanPixelError:mean, page:'faint diagonal hatch'};
  } finally { probe.remove(); }
}

export async function checkFloatingPolish() {
  await go('/components/button'); await go('/components');
  const anchor = document.querySelector('.catalog-material .dg-popover-anchor'), trigger = anchor.querySelector('button');
  const layer = document.querySelector('.catalog-material .dg-popover-layer');
  const canvas = () => document.querySelector('.catalog-material :is(.dg-popover-anchor, .dg-popover-layer) > span > canvas[data-dg-renderer]');
  await until(() => canvas()?.width > 1, 'Material trigger not rendered');
  await new Promise(resolve => setTimeout(resolve, 500));
  const captured = await captureLiquidCanvas(canvas());
  try {
  const pixels = () => {
    const c = canvas(), a = trigger.getBoundingClientRect(), b = c.getBoundingClientRect();
    return captured.snapshot.getContext('2d').getImageData(Math.round((a.left - b.left) * 2), Math.round((a.top - b.top) * 2), Math.round(a.width * 2), Math.round(a.height * 2)).data;
  };
  const before = pixels(); trigger.click();
  await until(() => layer.matches(':popover-open'), 'Material panel not opened');
  await new Promise(resolve => setTimeout(resolve, 600));
  const controlCanvases = [...layer.querySelectorAll('.dg-popover__panel canvas[data-dg-renderer]')];
  const c = canvas(), ctx = captured.snapshot.getContext('2d');
  let shadowEdgeAlpha = 0;
  for (const data of [ctx.getImageData(0,0,c.width,1).data, ctx.getImageData(0,c.height-1,c.width,1).data, ctx.getImageData(0,0,1,c.height).data, ctx.getImageData(c.width-1,0,1,c.height).data]) {
    for(let i=3;i<data.length;i+=4) shadowEdgeAlpha = Math.max(shadowEdgeAlpha, data[i]);
  }
  assert(shadowEdgeAlpha === 0, `Shadow is cropped at alpha ${shadowEdgeAlpha}`);
  let clones = 0;
  const observer = new MutationObserver(records => { clones += records.filter(record => record.type === 'childList').length; });
  observer.observe(layer.querySelector('.dg-popover__trigger-ink'), { childList: true });
  const times = [], cssRead = window.getComputedStyle; let styleReads = 0;
  window.getComputedStyle = (...args) => { styleReads++; return cssRead(...args); };
  try {
    let previous = performance.now();
    for(let i=0;i<36;i++) {
      await new Promise(resolve => requestAnimationFrame(time => { times.push(time-previous); previous=time; window.scrollTo({top:(i+1)*8,behavior:'instant'}); resolve(); }));
    }
    await paint();
  } finally { window.getComputedStyle = cssRead; observer.disconnect(); }
  assert(clones === 0, 'Scrolling clones the trigger and forces typography/layout work');
  window.scrollTo({top:0,behavior:'instant'}); await paint();
  const start = performance.now(); trigger.click();
  await until(() => !layer.matches(':popover-open'), 'Material panel did not finish closing');
  const closeMs = performance.now()-start;
  assert(closeMs < 360, `Popover close took ${closeMs}ms`);
  await paint();
  assert(controlCanvases.length > 0 && controlCanvases.every(canvas=>canvas.isConnected), 'Closing the panel discards its measured control canvases');
  const after = pixels(); let pixelError=0;
  for(let i=0;i<before.length;i+=4) pixelError += Math.abs(before[i]-after[i]);
  pixelError /= before.length/4;
  assert(pixelError < .1, `Opening a panel changed the trigger's optical scale (mean error ${pixelError})`);
  assert(getComputedStyle(trigger).outlineColor === 'rgba(0, 0, 0, 0)' || getComputedStyle(trigger).outlineStyle === 'none', 'Focus restored a dark outline');
  times.shift(); times.sort((a,b)=>a-b);
  return { closeMs, shadowEdgeAlpha, triggerPixelError:pixelError, scrollTriggerClones:clones, scrollStyleReads:styleReads, frameMedian:times[Math.floor(times.length*.5)], frameP95:times[Math.floor(times.length*.95)] };
  } finally { captured.stop(); }
}

export async function checkHDRScroll() {
  if(!matchMedia('(dynamic-range: high)').matches || !window.GPUQueue) return {supported:false};
  await go('/components/button'); await go('/components');
  const anchor=document.querySelector('.catalog-material .dg-popover-anchor');
  await until(()=>anchor.querySelector('[data-dg-highlight-hdr]')?.style.opacity==='1','HDR trigger did not render');
  await new Promise(resolve=>setTimeout(resolve,500));
  const canvas=anchor.querySelector('canvas[data-dg-renderer]'), original=GPUQueue.prototype.copyExternalImageToTexture;
  let copies=0;
  GPUQueue.prototype.copyExternalImageToTexture=function(source,...args){if(source.source===canvas)copies++;return original.call(this,source,...args)};
  const rect=anchor.getBoundingClientRect();
  const pointer=(target,type,buttons)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:77,pointerType:'mouse',isPrimary:true,buttons,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2}));
  try {
    for(let i=1;i<=12;i++){window.scrollTo({top:i*7,behavior:'instant'});await paint()}
    assert(copies===0,'Scrolling re-renders an unchanged HDR light mask');
    pointer(anchor,'pointerdown',1);
    await until(()=>copies>0,'HDR caching froze the live contact light');
    return {backgroundHDRCopies:0,contactHDRUpdates:true};
  } finally { pointer(window,'pointercancel',0);GPUQueue.prototype.copyExternalImageToTexture=original;window.scrollTo({top:0,behavior:'instant'}); }
}

export async function checkContactHDR() {
  const { createHighlightHDR } = await import('../../../packages/react-liquid-glass/src/liquid-glass/highlight-hdr.ts');
  const { createLiquidGlassRenderer } = await import('refractive-glass-react/liquid-glass/renderer');
  const host = document.createElement('div'), canvas = document.createElement('canvas'), source = document.createElement('canvas');
  host.style.cssText = 'position:fixed;left:-1000px;top:0;width:240px;height:140px'; host.append(canvas); document.body.append(host);
  source.width = 240; source.height = 140; const ctx = source.getContext('2d'); ctx.fillStyle = '#333'; ctx.fillRect(0,0,240,140);
  const renderer = createLiquidGlassRenderer(canvas, {shared:true}); let hdr;
  try {
    hdr = await createHighlightHDR(canvas);
    if (!hdr) return { hdr: 'unavailable; ordinary WebGL contact light remains active' };
    const overlay = host.querySelector('[data-dg-highlight-hdr]'), context = overlay.getContext('webgpu'), configuration = context.getConfiguration(), device = configuration.device;
    context.configure({...configuration, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC});
    renderer.draw({source, width:240, height:140, pixelRatio:1, transparentOutside:true, blobs:[{x:.5,y:.5,radius:24,halfWidth:80,halfHeight:30,contactX:.8,contactY:0,contactStrength:1,pullX:3,pullY:-1}]}, hdr.draw);
    const bytesPerRow = 2048, buffer = device.createBuffer({size:bytesPerRow*140,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try {
      const commands = device.createCommandEncoder(); commands.copyTextureToBuffer({texture:context.getCurrentTexture()},{buffer,bytesPerRow},[240,140]); device.queue.submit([commands.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);
      const values = new Float16Array(buffer.getMappedRange()); let peak = 0;
      for(let y=0;y<140;y++) for(let x=0;x<240;x++) peak=Math.max(peak,values[y*bytesPerRow/2+x*4]);
      assert(peak > 1, `HDR contact never exceeded SDR white (peak ${peak})`);
      assert(configuration.toneMapping.mode === 'extended', 'HDR output was tone mapped to SDR');
      assert(renderer.stats.emissionDraws === 1 && renderer.stats.sourceUploads === 1, 'HDR duplicated source capture or material work');
      buffer.unmap();
      // A static reflection emits extra light too, without illuminating the whole body.
      ctx.fillStyle = '#eee'; ctx.fillRect(0,0,240,140);
      const frame = {source, sourceRevision:1, width:240, height:140, pixelRatio:1, transparentOutside:true, blobs:[{x:.5,y:.5,radius:24,halfWidth:80,halfHeight:30}]};
      renderer.draw(frame);
      const baseline = canvas.getContext('2d').getImageData(0,0,240,140).data;
      renderer.draw(frame, hdr.draw);
      const ordinary = canvas.getContext('2d').getImageData(0,0,240,140).data;
      assert(ordinary.every((value,index) => value === baseline[index]), 'The HDR mask replaced or changed the base material');
      const staticCopy = device.createCommandEncoder(); staticCopy.copyTextureToBuffer({texture:context.getCurrentTexture()},{buffer,bytesPerRow},[240,140]); device.queue.submit([staticCopy.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);
      const rim = new Float16Array(buffer.getMappedRange()); let compositePeak = 0;
      for (let y=0;y<140;y++) for (let x=0;x<240;x++) {
        const offset=y*bytesPerRow/2+x*4, base=baseline[(y*240+x)*4]/255;
        const linear=base<=.04045 ? base/12.92 : ((base+.055)/1.055)**2.4;
        compositePeak=Math.max(compositePeak,linear*(1-rim[offset+3])+rim[offset]);
      }
      assert(compositePeak > 1.1, `Static rim did not exceed SDR white (${compositePeak})`);
      assert(rim[70*bytesPerRow/2+120*4] === 0, 'HDR washed over the clear center');
      assert(rim[70*bytesPerRow/2+41*4] === 0, 'HDR reflection leaked down a straight sidewall');
      buffer.unmap();
      // Pin the independent channel gains: green is rim, red is contact.
      for (const [color, gain, alpha] of [['#0f0', 4*.26, .12*.26], ['#f00', 2.4, .35]]) {
        ctx.fillStyle=color;ctx.fillRect(0,0,240,140);hdr.draw(source);
        const copy=device.createCommandEncoder();copy.copyTextureToBuffer({texture:context.getCurrentTexture()},{buffer,bytesPerRow},[240,140]);device.queue.submit([copy.finish()]);
        await buffer.mapAsync(GPUMapMode.READ);
        const sample=new Float16Array(buffer.getMappedRange());
        assert(Math.abs(sample[0]-gain)<.005 && Math.abs(sample[3]-alpha)<.002, `Wrong HDR channel gain for ${color}`);
        buffer.unmap();
      }
      return {format:configuration.format, mode:configuration.toneMapping.mode, contactPeak:peak, rimCompositePeak:compositePeak, edgeGain:.26, displayHDR:matchMedia('(dynamic-range: high)').matches};
    } finally { buffer.destroy(); }
  } finally { hdr?.dispose(); renderer.dispose(); host.remove(); }
}

export async function checkMaterialOptics() {
  const { createLiquidGlassRenderer } = await import('refractive-glass-react/liquid-glass/renderer');
  const { liquidSurfaceBlur } = await import('refractive-glass-react/liquid-glass');
  const { SURFACE_MATERIAL } = await import('../../../packages/react-liquid-glass/src/controls/GlassSurface.tsx');
  const source=document.createElement('canvas'), canvas=document.createElement('canvas'), mask=document.createElement('canvas');
  source.width=mask.width=320; source.height=mask.height=220;
  const ctx=source.getContext('2d'), capture=surface => { mask.width=surface.width; mask.height=surface.height; mask.getContext('2d').drawImage(surface,0,0); };
  const renderer=createLiquidGlassRenderer(canvas);
  const frame={...SURFACE_MATERIAL,source,width:320,height:220,pixelRatio:2,edgeDepth:10,domeDepth:18,blobs:[{x:.5,y:.5,radius:24,halfWidth:120,halfHeight:70}]};
  const pixels=() => { const copy=document.createElement('canvas'); copy.width=canvas.width; copy.height=canvas.height; const context=copy.getContext('2d'); context.drawImage(canvas,0,0); return context.getImageData(0,0,copy.width,copy.height).data; };
  const red=(data,x,y) => data[(Math.floor(y*2)*640+Math.floor(x*2))*4];
  try {
    ctx.fillStyle='#eee';ctx.fillRect(0,0,320,220);renderer.draw(frame); const ordinary=pixels();
    const side=Math.min(...[.25,.75,1.25].map(d=>red(ordinary,40+d,110)));
    const top=Math.min(...[.25,.75,1.25].map(d=>red(ordinary,160,40+d)));
    const inner=Math.min(...[3,4,5,6,8,10].map(d=>red(ordinary,160,40+d)));
    assert(top-side>20 && top>=205, `Directional rim flattened: side ${side}, top ${top}`);
    assert(inner>232, `Broad black glow returned: ${inner}`);
    assert(red(ordinary,42,110)>232, 'Side contour extends too far into the glass');
    renderer.draw({...frame,blobs:[...frame.blobs,{x:.95,y:.9,radius:16,halfWidth:0,halfHeight:0}]});
    assert(pixels().every((value,index)=>value===ordinary[index]),'A dissolved trigger left a phantom lens or shadow');
    renderer.draw({...frame,backdropDim:.5});const dimmed=red(pixels(),160,110);
    assert(dimmed>100&&dimmed<140,'Modal glass does not follow the black mask beneath it');
    renderer.draw(frame,capture);const after=pixels();
    assert(after.every((value,index)=>value===ordinary[index]), 'Direct renderer ended on the HDR mask');
    const light=mask.getContext('2d').getImageData(0,0,640,440).data;
    assert(light.some((value,index)=>index%4===1&&value>10),'Static rim emission missing');
    const ink=document.createElement('canvas');ink.width=240;ink.height=140;ink.getContext('2d').fillRect(0,0,240,140);
    for (const override of [{tintStrength:1},{opacity:0},{content:ink,contentOpacity:1}]) {
      renderer.draw({...frame,...override},capture);
      const hidden=mask.getContext('2d').getImageData(0,0,640,440).data;
      assert(hidden.every((value,index)=>index%4>1||value===0),'HDR escaped opaque ink, tint or opacity');
    }
    for(let x=0;x<320;x++){ctx.fillStyle=x%8<4?'#555':'#ddd';ctx.fillRect(x,0,1,220);}
    const contrast=blurStrength=>{renderer.draw({...frame,sourceRevision:1,blurStrength});const data=pixels(),values=Array.from({length:120},(_,i)=>red(data,100+i,110));return Math.max(...values)-Math.min(...values);};
    const clear=contrast(liquidSurfaceBlur(180,36)),frosted=contrast(liquidSurfaceBlur(180,152));
    assert(clear>80 && frosted<clear*.2, `Large popup frost did not soften the substrate: ${clear}/${frosted}`);
    return {side,top,inner,clearContrast:clear,frostedContrast:frosted,directHDR:'base preserved, light occluded'};
  } finally {renderer.dispose();}
}

const sampleMotion = async (duration, read) => {
  const samples=[], start=performance.now();
  do { await new Promise(requestAnimationFrame); samples.push(read()); } while(performance.now()-start < duration);
  return samples;
};
export async function checkConsolidatedControls() {
  await document.fonts.ready;
  for(const [alias,id] of Object.entries(componentAliases)) {
    history.pushState(null,'',`/components/${alias}`);window.dispatchEvent(new PopStateEvent('popstate'));
    await until(()=>location.pathname===`/components/${id}`,`${alias} did not redirect`);
  }
  await go('/components/tabs');
  const tabs=document.querySelector('[role=tablist]'), before=tabs.getBoundingClientRect();
  click('[role=tab]:nth-of-type(3)');await sampleMotion(650,()=>null);
  const after=tabs.getBoundingClientRect();
  assert(!document.querySelector('[role=tabpanel]') && Math.abs(before.y-after.y)<.5,`Tabs demo changes layout: ${before.y} -> ${after.y}; panels ${document.querySelectorAll('[role=tabpanel]').length}`);
  await go('/components/toggle');
  const toggle=document.querySelector('.dg-toggle'), svg=toggle.querySelector('svg');
  const width=toggle.getBoundingClientRect().width;toggle.click();
  const fills=await sampleMotion(250,()=>+getComputedStyle(svg).fillOpacity);
  assert(fills.some(v=>v>0&&v<1) && fills.at(-1)===1,'Toggle fill jumps instead of transitioning');
  assert(Math.abs(toggle.getBoundingClientRect().width-width)<.5,'Toggle label changes width');
  await go('/components/toast');
  const button=document.querySelector('.component-preview .dg-button'), y=button.getBoundingClientRect().y;
  button.click();const opening=await sampleMotion(360,()=>button.getBoundingClientRect().y), end=opening.at(-1);
  click('.dg-toast .dg-dismiss');const closing=await sampleMotion(360,()=>button.getBoundingClientRect().y);
  assert(opening.filter(v=>v<y-1&&v>end+1).length>2 && closing.filter(v=>v> end+1&&v<y-1).length>2,'Toast still jumps the neighboring button');
  assert(Math.abs(closing.at(-1)-y)<.5,'Toast did not release its space');
  for(const [id,expected] of [['morph-menu',0],['dropdown-menu',1]]) {
    await go(`/components/${id}`);const trigger=click('.dg-popover-anchor > button');
    await until(()=>document.querySelector('.dg-popover__panel')?.style.opacity==='1','Menu did not settle');
    const mirror=document.querySelector('.dg-popover__trigger-ink');
    assert(+mirror.style.opacity===expected,`${id} has the wrong trigger lifecycle`);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await until(()=>!document.querySelector('.dg-popover-layer:popover-open'),'Menu did not close');
    assert(document.activeElement===trigger && !trigger.closest('[inert]'),'Menu did not restore an interactive trigger');
  }
  return {aliases:Object.keys(componentAliases),tabs:'stable',toggle:'interpolated',toast:'continuous layout',menus:'distinct trigger lifecycles'};
}
export async function checkModalMotion() {
  const {subscribeLiquidFrames}=await import('refractive-glass-react/liquid-glass/renderer');
  const results=[];
  for(const id of ['dialog','sheet']) {
    await go(`/components/${id}`);
    const trigger=document.querySelector('.component-preview > .dg-stage__contents > .dg-button');
    const rect=trigger.getBoundingClientRect(), x=rect.left+rect.width*.2, y=rect.top+rect.height*.3;
    trigger.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,clientX:x,clientY:y}));
    const dialog=document.querySelector('.component-preview dialog'), panel=dialog.querySelector('.dg-dialog__body'), mask=dialog.querySelector('.dg-dialog__mask');
    const read=()=>{const r=panel.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,mask:+mask.style.opacity,open:dialog.open}};
    const initial=await sampleMotion(600,read), last=initial.at(-1);
    assert(initial.some(v=>v.w<last.w*.75&&Math.hypot(v.x-x,v.y-y)<Math.hypot(last.x-x,last.y-y)*.6+12),`${id} did not originate at the click`);
    assert(initial.some(v=>v.mask>0&&v.mask<1),`${id} mask skipped entrance`);
    assert(last.w<=innerWidth && last.h<=innerHeight && dialog.contains(document.activeElement),`${id} exceeds the viewport or lost focus`);
    click('.dg-dismiss',dialog);const closing=await sampleMotion(420,read);
    assert(closing.some(v=>v.open&&v.mask>0&&v.mask<1),'Mask did not fade during closing');
    assert(!dialog.open && document.activeElement===trigger,`${id} did not finish/restored focus`);
    // Controlled consumers can retarget while the native modal is still exiting.
    for(let i=0;i<2;i++){trigger.click();await sampleMotion(75,()=>null);click('.dg-dismiss',dialog);await sampleMotion(45,()=>null);}
    trigger.click();await sampleMotion(650,()=>null);
    assert(dialog.open && +panel.style.opacity===1,`${id} failed rapid reversal`);
    let idleFrames=0;const stop=subscribeLiquidFrames(()=>idleFrames++);
    await sampleMotion(180,()=>null);stop();assert(idleFrames===0,`${id} still redraws after settling`);
    dialog.dispatchEvent(new Event('cancel',{cancelable:true}));await until(()=>!dialog.open,'Escape did not dismiss modal');
    results.push({id,width:last.w,height:last.h,idleFrames});
  }
  return results;
}
export async function checkHDRPreference() {
  const original=window.matchMedia;
  // Exercise the real GPU presenter even when the test display itself is SDR.
  window.matchMedia=query=>{const result=original.call(window,query);if(query==='(dynamic-range: high)')Object.defineProperty(result,'matches',{value:true});return result;};
  try {
    await go('/playground?component=button&material='+encodeURIComponent(JSON.stringify({hdr:false})));
    const stage=document.querySelector('.component-preview');
    await until(()=>stage.querySelector('canvas[data-dg-renderer]')?.width>1,'Button optics missing');
    assert(!stage.querySelector('[data-dg-highlight-hdr]'),'Disabled HDR allocated a presenter');
    const toggle=document.querySelector('input[aria-label=HDR]');toggle.click();
    if(navigator.gpu && await navigator.gpu.requestAdapter()) {
      await until(()=>stage.querySelector('[data-dg-highlight-hdr]')?.style.opacity==='1','HDR did not enable');
      toggle.click();await paint();
      assert(stage.querySelector('[data-dg-highlight-hdr]').style.opacity==='0','HDR did not turn off');
    } else {toggle.click();}
    const prism=[...document.querySelectorAll('.preset-list button')].find(button=>button.textContent==='Prism');prism.click();await paint();
    assert(!toggle.checked && prism.getAttribute('aria-pressed')==='true','Preset selection reset HDR or lost its selected state');
    assert(JSON.parse(localStorage.getItem('glass-playground')).hdr===false,'HDR preference did not persist');
    click('button[aria-label="Reset material"]');await paint();assert(toggle.checked,'Reset did not restore default HDR');
    return {toggle:'live',presets:'preserve HDR',persistence:true};
  } finally {window.matchMedia=original;await go('/components/button');}
}
