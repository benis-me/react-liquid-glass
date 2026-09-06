// Run in the docs site's browser console (or through its CDP session):
// const qa = await import('/@fs/<repo>/apps/docs/tests/browser-smoke.mjs');
// await qa.checkCatalog(); await qa.checkInteractions(); await qa.checkPlayground();
// This uses the real React app and WebGL canvases, without a mock DOM or test framework.
import { catalog } from '../src/site/catalog.ts';
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
  for (const entry of catalog) {
    await go(`/components/${entry.id}`);
    await until(() => document.querySelector('main h1')?.textContent === entry.name, `Missing page for ${entry.id}`);
    assert(document.querySelector('.component-preview'), `Missing preview: ${entry.id}`);
    assert(document.querySelector('pre code')?.textContent.includes(entry.api), `Missing usage: ${entry.id}`);
    assert(document.documentElement.scrollWidth <= innerWidth + 1, `Horizontal overflow: ${entry.id}`);
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
  await go('/components/tabs'); click('[role="tab"]:nth-of-type(3)'); await paint(); assert(document.querySelector('[role="tabpanel"]:not([hidden])')?.textContent.includes('Import only'), 'Tabs did not expose the matching panel'); passed.push('tabs');
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
  click('.debug-field input'); await paint(); assert(document.querySelector('.playground-code code')?.textContent.includes('"debug": true'), 'Optical field is not connected');
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
  await go('/components/segmented');
  assert(document.querySelector('.dg-tabs__container canvas'), 'Segmented container has no glass renderer');
  await go('/components/tabs');
  assert(document.querySelector('.dg-tabs__container canvas'), 'Tabs container has no glass renderer');
  passed.push('segmented and tabs glass containers');
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
