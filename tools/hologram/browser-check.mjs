/** Local Chrome DevTools smoke checks. No browser packages or external requests. */
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createWordSampler, hologramFrame, hologramWords } from '../../src/lib/hologram/word-cycle.ts';

const origin = process.env.PORTFOLIO_URL ?? 'http://localhost:3001';
const debuggerUrl = process.env.PORTFOLIO_CHROME ?? 'http://127.0.0.1:9223';
const output = new URL('./private/direct-morph/', import.meta.url);
await mkdir(output, { recursive: true });
const page = await (await fetch(`${debuggerUrl}/json/new?about:blank`, { method: 'PUT' })).json();
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
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile });
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
  fallbackVisible: getComputedStyle(document.querySelector('.hologram-fallback')).visibility === 'visible' }))()`);

const report = {};
try {
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable'); await call('Network.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const proto = WebGL2RenderingContext.prototype;
    window.__hologramDraws = 0;
    window.__portraitSurfaces = 0;
    window.__portraitFrames = [];
    window.__portraitUniforms = {};
    const names = new WeakMap();
    const get = proto.getUniformLocation;
    proto.getUniformLocation = function(program, name) {
      const location = get.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const uniform = proto.uniform1f;
    proto.uniform1f = function(location, value) {
      const name = names.get(location);
      if (name) window.__portraitUniforms[name] = value;
      return uniform.call(this, location, value);
    };
    const vector = proto.uniform3f;
    proto.uniform3f = function(location, x, y, z) {
      if (names.get(location) === 'uCursor') window.__portraitCursor = [x, y, z];
      return vector.call(this, location, x, y, z);
    };
    const drawArrays = proto.drawArrays;
    proto.drawArrays = function(mode, ...args) {
      if (mode === this.POINTS) {
        window.__hologramDraws++;
        window.__portraitFrames.push({ ...window.__portraitUniforms, points: args[1] });
      }
      return drawArrays.call(this, mode, ...args);
    };
    const drawElements = proto.drawElements;
    proto.drawElements = function(...args) {
      window.__portraitSurfaces++;
      return drawElements.apply(this, args);
    };
  })()` });
  const delayed = await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    const loadPortraitAsset = window.fetch;
    window.fetch = async function(url, ...args) {
      if (String(url).endsWith('/facial-particles.bin')) await new Promise(resolve => setTimeout(resolve, 2000));
      return loadPortraitAsset.call(this, url, ...args);
    };
  ` });
  await viewport(1440, 1000);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await call('Page.navigate', { url: origin });
  await waitFor("document.querySelector('.portrait-preview-light')?.naturalWidth > 0");
  assert(await evaluate(`!document.querySelector('.hologram-ready') &&
    getComputedStyle(document.querySelector('.portrait-static-layer:nth-child(2)')).opacity === '0' &&
    getComputedStyle(document.querySelector('.portrait-preview-light')).opacity === '1'`));
  assert.equal((await inspect()).fallbackVisible, false);
  await waitFor("document.querySelector('.hologram-ready canvas')");
  report.firstFrame = await evaluate('window.__portraitFrames[0]');
  assert.equal(report.firstFrame.uReveal, 0);
  assert.equal(report.firstFrame.uScatter, 1);
  assert.equal(report.firstFrame.uWord, 0);
  assert.equal(report.firstFrame.uLightTheme, 1);
  assert.equal(report.firstFrame.points, 23500);
  assert.equal(await evaluate('window.__portraitSurfaces'), 0);
  assert.equal(new Set(hologramWords).size, 20);
  for (let index = 0; index <= hologramWords.length; index++) {
    const start = 1.2 + 9.9 * index;
    assert.equal(hologramFrame(start + 4.99).word, 0);
    for (const hold of [6.401, 8.399]) {
      assert.deepEqual(hologramFrame(start + hold), { index: index % hologramWords.length, scatter: 0, word: 1 });
    }
  }
  report.wordMasks = await evaluate(`(() => {
    const sample = (${createWordSampler.toString()})();
    const target = new Float32Array(23500 * 3);
    return ${JSON.stringify(hologramWords)}.map(word => {
      const count = sample(word, target);
      const xs = Array.from({ length: count }, (_, index) => target[index * 3]);
      return { word, count, width: Math.max(...xs) - Math.min(...xs) };
    });
  })()`);
  assert(report.wordMasks.every(({ count, width }) => count > 300 && count < 11000 && width > .9 && width < 3.35));
  await shot('assembling-light', 1000);
  await waitFor('window.__portraitFrames.at(-1).uScatter === 0');
  await shot('assembled-light', 1000);
  report.desktop = await inspect();
  assert(!report.desktop.overflow && report.desktop.canvas && report.desktop.ready && report.desktop.imageLoaded);
  assert.equal(report.desktop.missingLinks.length, 0);
  report.webglError = await evaluate("document.querySelector('.hologram-canvas canvas').getContext('webgl2').getError()");
  assert.equal(report.webglError, 0);

  await evaluate("window.portraitCanvas = document.querySelector('.hologram-canvas canvas'); true");
  async function checkWordCycle(theme) {
    await waitFor('window.__portraitFrames.at(-1).uWord > .35 && window.__portraitFrames.at(-1).uWord < .75');
    await shot(`face-to-word-${theme}`, 1000);
    await waitFor('window.__portraitFrames.at(-1).uWord === 1');
    await waitFor("Number(getComputedStyle(document.querySelector('.code-field')).opacity) < .25");
    await shot(`creative-${theme}`, 1000);
    await waitFor('window.__portraitFrames.at(-1).uWord < .75 && window.__portraitFrames.at(-1).uWord > .35');
    await shot(`word-to-face-${theme}`, 1000);
    await waitFor('window.__portraitUniforms.uTime > 11.25');
    const samples = await evaluate(`[1.4, 6, 6.9, 8, 9.4, 10.35, 11.25].map(time => window.__portraitFrames
      .reduce((closest, frame) => Math.abs(frame.uTime - time) < Math.abs(closest.uTime - time) ? frame : closest))`);
    assert.deepEqual([0, 1, 3, 4, 6].map(index => samples[index].uWord), [0, 0, 1, 1, 0]);
    assert([samples[2], samples[5]].every(frame => frame.uWord > .35 && frame.uWord < .65));
    assert(samples.every(frame => frame.uScatter === 0));
    return samples.map(({ uTime, uScatter, uWord }) => ({ time: uTime, scatter: uScatter, word: uWord }));
  }
  report.lightWordCycle = await checkWordCycle('light');
  await evaluate(`document.querySelector('input[name="appearance-desktop"][value="dark"]').click()`);
  await waitFor("document.documentElement.dataset.theme === 'dark' && window.__portraitUniforms.uLightTheme < .08");
  assert(await evaluate(`window.portraitCanvas === document.querySelector('.hologram-canvas canvas') &&
    window.__portraitFrames.at(-1).points === 17280`));
  await evaluate(`document.querySelector('input[name="appearance-desktop"][value="light"]').click()`);
  await waitFor('window.__portraitFrames.at(-1).uLightTheme === 1');
  assert(await evaluate(`window.portraitCanvas === document.querySelector('.hologram-canvas canvas') &&
    window.__portraitFrames.at(-1).points === 23500`));
  report.themeGeometrySwitch = true;
  await evaluate(`document.querySelector('input[name="appearance-desktop"][value="dark"]').click()`);
  await waitFor('window.__portraitFrames.at(-1).uLightTheme === 0');
  assert.equal(await evaluate('window.__portraitSurfaces'), 0);

  const pointer = await evaluate(`(() => {
    const rect = document.querySelector('.portrait-hold').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pointer });
  await waitFor('window.__portraitCursor?.[2] > .7');
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 80 });
  await waitFor('window.__portraitCursor?.[2] < .1');
  report.pointerResponse = true;

  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: delayed.identifier });
  await call('Page.reload', { ignoreCache: true });
  await waitFor("document.querySelector('.hologram-ready canvas') && window.__portraitFrames.length > 0");
  report.hardRefreshFirstFrame = await evaluate('window.__portraitFrames[0]');
  assert.equal(report.hardRefreshFirstFrame.uReveal, 0);
  assert.equal(report.hardRefreshFirstFrame.uScatter, 1);
  assert.equal(report.hardRefreshFirstFrame.uLightTheme, 0);
  await shot('assembling-dark', 1000);
  await waitFor('window.__portraitFrames.at(-1).uScatter === 0');
  await shot('assembled-dark', 1000);
  report.darkWordCycle = await checkWordCycle('dark');
  const aboutScroll = await evaluate(`new Promise(resolve => {
    const samples = [];
    const start = performance.now();
    document.querySelector('.hero-bottom a[href="#about"]').click();
    function sample(now) {
      samples.push(window.scrollY);
      if (now - start < 1200) requestAnimationFrame(sample);
      else resolve({ samples: [...new Set(samples)].length, hash: location.hash,
        aboutTop: document.querySelector('#about').getBoundingClientRect().top,
        headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom });
    }
    requestAnimationFrame(sample);
  })`);
  assert(aboutScroll.samples > 2 && aboutScroll.hash === '#about', JSON.stringify(aboutScroll));
  assert(aboutScroll.aboutTop >= aboutScroll.headerBottom && aboutScroll.aboutTop < 160, JSON.stringify(aboutScroll));
  report.aboutScroll = aboutScroll;
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
  assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollBehavior'), 'auto');
  await shot('reduced-motion', 1000);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await waitFor("document.querySelector('.hologram-ready canvas')");
  report.normalOperationErrors = [...errors];
  assert.equal(report.normalOperationErrors.length, 0, JSON.stringify(errors));
  for (const width of [768, 320, 375, 390]) {
    await viewport(width, 844, width < 700);
    await call('Page.navigate', { url: `${origin}/?viewport=${width}` });
    await waitFor(`location.search === '?viewport=${width}' && document.querySelector('.hologram-fallback img')?.naturalWidth > 0`);
    if (width === 390) {
      await waitFor("!document.querySelector('.portrait-hold').disabled");
      await evaluate("document.querySelector('.site-header .menu-toggle').click()");
      await waitFor("document.querySelector('#mobile-navigation').open && document.body.style.overflow === 'hidden'");
      await evaluate(`document.querySelector('#mobile-navigation a[href="#about"]').click()`);
      await waitFor(`location.hash === '#about' && !document.querySelector('#mobile-navigation').open &&
        document.querySelector('#about').getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom &&
        document.querySelector('#about').getBoundingClientRect().top < 150`);
      report.mobileAboutNavigation = true;
      await evaluate("history.replaceState(null, '', location.pathname + location.search); window.scrollTo({top:0,behavior:'instant'})");
    }
    await evaluate("document.querySelector('.hologram-visual').scrollIntoView({block:'center',behavior:'instant'})");
    try {
      await waitFor("document.querySelector('.hologram-ready')");
    } catch (cause) {
      throw new Error(`Viewport ${width} did not render: ${JSON.stringify({ ...await inspect(), errors })}`, { cause });
    }
    await evaluate("window.scrollTo({top:0,behavior:'instant'})");
    const state = await inspect(); report[`viewport${width}`] = state;
    assert(!state.overflow && state.imageLoaded, `Overflow or unloaded fallback at ${width}`);
    assert(state.canvas && state.quality === (width < 700 ? 'low' : 'medium'));
    const first = await evaluate('window.__portraitFrames[0]');
    assert.equal(first.uReveal, 0);
    assert.equal(first.uDpr, width < 700 ? 1.5 : 1);
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
  // Lose the live context from the final mobile viewport.
  await evaluate("document.querySelector('.hologram-canvas canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");
  await waitFor("!document.querySelector('.hologram-canvas canvas')");
  report.contextLoss = await inspect(); assert(!report.contextLoss.ready && report.contextLoss.imageLoaded);
  await shot('context-loss-fallback', await evaluate("Math.ceil(document.querySelector('.hero').getBoundingClientRect().height)"));
  // Fresh navigation without WebGL support.
  const injection = await call('Page.addScriptToEvaluateOnNewDocument', { source: `const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl' ? null : original.call(this, type, ...args); };` });
  await call('Page.navigate', { url: `${origin}/?webgl=unavailable` });
  await waitFor("location.search === '?webgl=unavailable' && document.querySelector('.hologram-art[data-static]') && document.querySelector('.hologram-fallback img')?.naturalWidth > 0");
  report.noWebgl = await inspect();
  assert(!report.noWebgl.ready && report.noWebgl.imageLoaded && report.noWebgl.fallbackVisible);
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  await call('Emulation.setScriptExecutionDisabled', { value: true });
  await call('Page.navigate', { url: `${origin}/?javascript=disabled` });
  await waitFor("document.querySelector('.hologram-fallback img')?.complete && document.querySelector('.hologram-fallback img')?.naturalWidth > 0");
  report.noJavaScript = await inspect(); assert(!report.noJavaScript.canvas && report.noJavaScript.imageLoaded && report.noJavaScript.fallbackVisible);
  await call('Emulation.setScriptExecutionDisabled', { value: false });
  report.errors = errors;
  report.externalPageRequests = [...new Set(requests.filter(url => /^https?:/.test(url) && !url.startsWith(origin + '/')))];
  assert.equal(report.externalPageRequests.length, 0, 'Unexpected external network request');
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await call('Page.close').catch(() => {}); socket.close(); }
