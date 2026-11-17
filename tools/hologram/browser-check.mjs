/** Local Chrome DevTools smoke checks. No browser packages or external requests. */
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = new URL('./private/browser/', import.meta.url);
await mkdir(output, { recursive: true });
const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
const page = pages.find(page => page.type === 'page');
assert(page, 'Start an isolated local Chrome debugging session on port 9223.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
const errors = [], requests = [];
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const task = pending.get(message.id);
    if (task) { pending.delete(message.id); if (message.error) task.reject(message.error); else task.resolve(message.result); }
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
  else if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async expression => {
  for (let attempt = 0; attempt < 80; attempt++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(150); }
  throw new Error(`Timed out: ${expression}`);
};
const viewport = async (width, height, mobile = false) => {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await call('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
};
const shot = async (name, height) => {
  const width = await evaluate('innerWidth');
  const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
  await writeFile(new URL(`${name}.png`, output), Buffer.from(data, 'base64'));
};
const inspect = () => evaluate(`(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
  ready: !!document.querySelector('.hologram-ready'), quality: document.querySelector('.hologram-art')?.dataset.quality,
  canvas: !!document.querySelector('.hologram-canvas canvas'), title: document.title,
  missingLinks: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(id => !document.getElementById(id)),
  imageLoaded: [...document.querySelectorAll('.hologram-fallback img')].every(image => image.complete && image.naturalWidth > 0),
  fallbackOpacity: Number(getComputedStyle(document.querySelector('.hologram-fallback')).opacity) }))()`);

const report = {};
try {
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable'); await call('Network.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `window.__hologramDraws = 0; for (const method of ['drawArrays', 'drawElements']) { const draw = WebGL2RenderingContext.prototype[method]; WebGL2RenderingContext.prototype[method] = function(...args) { window.__hologramDraws++; return draw.apply(this, args); }; }` });
  await viewport(1440, 1000);
  await call('Page.navigate', { url: 'http://localhost:3001' });
  await waitFor("document.querySelector('.hologram-ready canvas') && document.querySelector('.hologram-fallback img')?.complete");
  await pause(2500);
  report.frameIntervals = await evaluate(`new Promise(resolve => { const values = []; let previous; const frame = now => { if (previous !== undefined) values.push(now - previous); previous = now; if (values.length < 90) requestAnimationFrame(frame); else { const sorted = [...values].sort((a,b)=>a-b); resolve({ samples: values.length, meanMs: values.reduce((a,b)=>a+b,0)/values.length, p95Ms: sorted[Math.floor(sorted.length*.95)] }); } }; requestAnimationFrame(frame); })`);
  report.desktop = await inspect();
  assert(!report.desktop.overflow && report.desktop.canvas && report.desktop.ready && report.desktop.imageLoaded);
  assert.equal(report.desktop.missingLinks.length, 0);
  report.webglError = await evaluate("document.querySelector('.hologram-canvas canvas').getContext('webgl2').getError()");
  assert.equal(report.webglError, 0);
  await shot('desktop-1440', 1000);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 250 }); await pause(900); await shot('pointer-left', 1000);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1390, y: 700 }); await pause(900); await shot('pointer-right', 1000);
  // Exit the hero and verify the page remains usable after returning.
  await evaluate("window.scrollTo({top: document.getElementById('contact').offsetTop, behavior:'instant'})"); await pause(400);
  report.offscreenCanvasMounted = await evaluate("!!document.querySelector('.hologram-canvas canvas')");
  const drawsBefore = await evaluate('window.__hologramDraws'); await pause(500);
  const drawsAfter = await evaluate('window.__hologramDraws');
  report.offscreenDraws = drawsAfter - drawsBefore; assert.equal(report.offscreenDraws, 0);
  await evaluate("window.scrollTo({top:0,behavior:'instant'})"); await pause(500);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor("!document.querySelector('.hologram-canvas canvas')");
  report.reducedMotion = await inspect(); assert.equal(report.reducedMotion.quality, 'static');
  await shot('reduced-motion', 1000);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await waitFor("document.querySelector('.hologram-ready canvas')");
  report.normalOperationErrors = [...errors];
  assert.equal(report.normalOperationErrors.length, 0, JSON.stringify(errors));
  // Test the real context loss path, rather than only checking a fallback flag.
  await evaluate("document.querySelector('.hologram-canvas canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");
  await waitFor("!document.querySelector('.hologram-canvas canvas')");
  report.contextLoss = await inspect(); assert(!report.contextLoss.ready && report.contextLoss.imageLoaded);
  await shot('context-loss-fallback', 1000);
  for (const width of [320, 375, 390, 768]) {
    await viewport(width, 844, width < 700);
    await call('Page.navigate', { url: `http://localhost:3001/?viewport=${width}` });
    await waitFor("document.querySelector('.hologram-fallback img')?.complete && document.querySelector('.hologram-fallback img')?.naturalWidth > 0");
    await pause(1500);
    await waitFor("document.querySelector('.hologram-ready') || Number(getComputedStyle(document.querySelector('.hologram-fallback')).opacity) === 1");
    const state = await inspect(); report[`viewport${width}`] = state;
    assert(!state.overflow && state.imageLoaded, `Overflow or unloaded fallback at ${width}`);
    if (width < 700) assert(!state.canvas && state.quality === 'static');
    const height = await evaluate("Math.ceil(document.querySelector('.hero').getBoundingClientRect().height)");
    await shot(`viewport-${width}`, height);
    if (width === 390) {
      await evaluate("document.querySelector('.site-header .menu-toggle').focus(); document.querySelector('.site-header .menu-toggle').click()");
      assert(await evaluate("document.querySelector('#mobile-navigation').open && document.body.style.overflow === 'hidden'"));
      await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 53 });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 53 });
      await pause(100);
      assert(await evaluate("!document.querySelector('#mobile-navigation').open && document.activeElement === document.querySelector('.site-header .menu-toggle') && document.body.style.overflow !== 'hidden'"));
      report.mobileMenuEscapeAndRestoration = true;
    }
  }
  // Fresh navigation without WebGL support.
  await viewport(1440, 1000);
  const injection = await call('Page.addScriptToEvaluateOnNewDocument', { source: `const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl' ? null : original.call(this, type, ...args); };` });
  await call('Page.navigate', { url: 'http://localhost:3001/?webgl=unavailable' });
  await waitFor("document.querySelector('.hologram-fallback img')?.complete && document.querySelector('.hologram-fallback img')?.naturalWidth > 0");
  await pause(1500);
  report.noWebgl = await inspect(); assert(!report.noWebgl.ready && report.noWebgl.imageLoaded);
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  await call('Emulation.setScriptExecutionDisabled', { value: true });
  await call('Page.navigate', { url: 'http://localhost:3001/?javascript=disabled' });
  await waitFor("document.querySelector('.hologram-fallback img')?.complete && document.querySelector('.hologram-fallback img')?.naturalWidth > 0");
  report.noJavaScript = await inspect(); assert(!report.noJavaScript.canvas && report.noJavaScript.imageLoaded);
  await call('Emulation.setScriptExecutionDisabled', { value: false });
  report.errors = errors;
  report.externalPageRequests = [...new Set(requests.filter(url => /^https?:/.test(url) && !url.startsWith('http://localhost:3001')))];
  assert.equal(report.externalPageRequests.length, 0, 'Unexpected external network request');
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { socket.close(); }
