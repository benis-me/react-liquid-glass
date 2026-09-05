// Run through the local Vite server:
// await import('/tests/browser-core.mjs').then(module => module.verifyColorProbe())
import { liquidCssColor } from '../src/lib/liquid-glass/source.ts';

export async function verifyColorProbe() {
  const root = document.createElement('div');
  const child = document.createElement('span');
  root.style.cssText = 'color:rgb(12, 34, 56);--probe-ink:rgb(80, 90, 100);position:fixed;visibility:hidden;transition:color .001ms';
  child.textContent = 'Inherited foreground';
  child.style.transition = 'color .001ms';
  root.appendChild(child);
  document.body.appendChild(root);
  await new Promise(resolve => setTimeout(resolve, 40));
  const mutations = [];
  let transitions = 0;
  const observer = new MutationObserver(records => mutations.push(...records));
  observer.observe(root, { attributes: true, childList: true, subtree: true });
  root.addEventListener('transitionend', () => { transitions++; });
  const before = root.outerHTML;
  try {
    for (const [value, expected] of [
      ['white', 'rgb(255, 255, 255)'],
      ['var(--probe-ink)', 'rgb(80, 90, 100)'],
      ['var(--missing, var(--probe-ink))', 'rgb(80, 90, 100)'],
      ['currentColor', 'rgb(12, 34, 56)'],
    ]) {
      const actual = liquidCssColor(root, value);
      if (actual !== expected) throw new Error(`${value}: ${actual} != ${expected}`);
    }
    await new Promise(resolve => setTimeout(resolve, 60));
    mutations.push(...observer.takeRecords());
    if (root.outerHTML !== before || mutations.length || transitions) {
      throw new Error(`Color probing changed the live source: ${mutations.length} mutations, ${transitions} transitions`);
    }
    return { colors: 4, sourceMutations: mutations.length, sourceTransitions: transitions };
  } finally {
    observer.disconnect();
    root.remove();
  }
}
