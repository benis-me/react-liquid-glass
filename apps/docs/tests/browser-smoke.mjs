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
  await go('/components/input'); input(document.querySelector('.dg-field input'), 'Glass test'); await paint(); assert(document.querySelector('.example-status')?.textContent.includes('Glass test'), 'Input failed'); passed.push('input');
  await go('/components/checkbox'); assert(click('.dg-choice input').checked, 'Checkbox failed'); passed.push('checkbox');
  await go('/components/radio-group'); const radio = click('input[value="motion"]'); await paint(); assert(radio.checked && !document.querySelector('input[value="design"]').checked, 'Radio group failed'); passed.push('radio');
  await go('/components/dialog'); const trigger = click('.component-preview > .dg-stage__contents > .dg-button'); await until(() => document.querySelector('dialog')?.open, 'Dialog did not open'); assert(document.querySelector('dialog').contains(document.activeElement), 'Dialog did not receive focus'); click('dialog .dg-dismiss'); await until(() => !document.querySelector('dialog')?.open, 'Dialog did not close'); assert(document.activeElement === trigger, 'Dialog did not restore focus'); passed.push('dialog');
  await go('/components/dropdown-menu'); click('.dg-popover-anchor button'); await until(() => document.querySelector('.dg-popover')?.matches(':popover-open'), 'Popover did not open'); await paint(); const menu = document.querySelector('.dg-dropdown'); menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); assert(document.activeElement?.textContent === 'Reset', 'Arrow navigation failed'); click('[role="menuitem"]', menu); await until(() => !document.querySelector('.dg-popover')?.matches(':popover-open'), 'Menu did not close'); assert(document.querySelector('.example-status')?.textContent.includes('1 copies'), 'Menu action did not fire'); passed.push('dropdown');
  await go('/components/accordion'); click('.dg-accordion summary'); await paint(); assert(document.querySelector('.dg-accordion details')?.open, 'Accordion failed'); passed.push('accordion');
  await go('/components/toast'); click('.component-preview .dg-button'); await paint(); assert(document.querySelector('.dg-toast')?.textContent.includes('saved'), 'Toast missing'); click('.dg-toast .dg-dismiss'); await paint(); assert(!document.querySelector('.dg-toast')?.textContent, 'Toast did not dismiss'); passed.push('toast');
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
  click('.material-advanced summary'); await paint(); assert(document.querySelectorAll('.material-field').length === 21, 'Advanced fields incomplete');
  click('.debug-field input'); await paint(); assert(document.querySelector('.playground-code code')?.textContent.includes('"debug": true'), 'Optical field is not connected');
  click('button[aria-label="Reset material"]'); await paint(); assert(localStorage.getItem('glass-playground') === '{}', 'Reset failed');
  return { material: 'live, persisted, reset', parameters: 21, debug: true };
}
