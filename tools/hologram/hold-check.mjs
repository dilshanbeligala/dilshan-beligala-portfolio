/** Native local Chrome input checks; no browser dependencies or production test hooks. */
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = new URL('./private/hold/', import.meta.url);
await mkdir(output, { recursive: true });
const page = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const pending = new Map(), errors = [], requests = [];
let nextId = 0;
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const task = pending.get(message.id); pending.delete(message.id);
    if (task) { if (message.error) task.reject(message.error); else task.resolve(message.result); }
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
  else if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async expression => {
  for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); }
  throw new Error(`Timed out: ${expression}`);
};
const viewport = async (width, mobile = false) => {
  await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile });
  await call('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
};
const revealState = () => evaluate(`({ requested: document.querySelector('.hologram-art').dataset.revealed === 'true', progress: document.querySelector('.hologram-ready') ? window.__portraitReveal : Number(document.querySelectorAll('.portrait-static-layer')[1].style.opacity), latched: document.querySelector('.portrait-toggle').getAttribute('aria-pressed') === 'true' })`);
const expected = async (requested, complete = true) => {
  await waitFor(`document.querySelector('.hologram-art').dataset.revealed === '${requested}'`);
  if (complete) await pause(requested ? 500 : 650);
  const state = await revealState();
  assert.equal(state.requested, requested);
  if (complete) assert(Math.abs(state.progress - Number(requested)) < .015, JSON.stringify(state));
  return state;
};
const center = () => evaluate(`(() => { const r = document.querySelector('.portrait-hold').getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
const mouse = (type, x, y, buttons = 0) => call('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
const press = async () => { const p = await center(); await mouse('mousePressed', p.x, p.y, 1); };
const release = async () => { const p = await center(); await mouse('mouseReleased', p.x, p.y); };
const shot = async name => {
  const { data } = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL(`${name}.png`, output), Buffer.from(data, 'base64'));
};
const key = (type, value, repeat = false) => call('Input.dispatchKeyEvent', { type, key: value, code: value === ' ' ? 'Space' : 'Enter', windowsVirtualKeyCode: value === ' ' ? 32 : 13, autoRepeat: repeat });
const report = {};
try {
  for (const method of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) await call(method);
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const names = new WeakMap(), programs = new WeakSet();
    const get = WebGL2RenderingContext.prototype.getUniformLocation;
    WebGL2RenderingContext.prototype.getUniformLocation = function(program,name) { const location = get.call(this,program,name); if (location) names.set(location,{name,program}); if(name==='uReveal') programs.add(program); return location; };
    const uniform = WebGL2RenderingContext.prototype.uniform1f;
    WebGL2RenderingContext.prototype.uniform1f = function(location,value) { if(names.get(location)?.name==='uReveal') window.__portraitReveal=value; return uniform.call(this,location,value); };
    const matrix = WebGL2RenderingContext.prototype.uniformMatrix4fv;
    WebGL2RenderingContext.prototype.uniformMatrix4fv = function(location,...args) { const info=names.get(location); if(info?.name==='modelViewMatrix'&&programs.has(info.program)) window.__portraitMatrix=Array.from(args[1]); return matrix.call(this,location,...args); };
    document.addEventListener('pointerdown',event=>window.__lastPointer=event.pointerId);
  })();` });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await viewport(1440);
  await mouse('mouseReleased', 0, 0);
  await call('Page.navigate', { url: 'http://localhost:3001/?check=hold' });
  await waitFor("document.querySelector('.hologram-ready canvas') && !document.querySelector('.portrait-hold').disabled");
  await pause(2300);
  const p = await center(); await mouse('mouseMoved', p.x, p.y); await pause(1100);
  report.initial = await expected(false);
  assert(await evaluate("document.querySelector('.portrait-toggle').getBoundingClientRect().bottom <= document.querySelector('.hero').getBoundingClientRect().bottom"), 'Instruction control clipped by hero');
  await shot('desktop-digital');
  const before = await evaluate('window.__portraitMatrix');
  await press(); report.pointerHold = await expected(true); await shot('desktop-real');
  const after = await evaluate('window.__portraitMatrix');
  report.matrixMaxDifference = Math.max(...before.map((value,index)=>Math.abs(value-after[index])));
  assert(report.matrixMaxDifference < .002, `Head transform changed: ${report.matrixMaxDifference}`);
  await release(); report.pointerRelease = await expected(false); await shot('desktop-reconstructed');
  await press(); await pause(120); const first = await revealState();
  await release(); await pause(90); const reversed = await revealState();
  await press(); await pause(120); const second = await revealState();
  assert(first.progress > 0 && first.progress < 1 && reversed.progress < first.progress && second.progress > reversed.progress);
  await release(); await expected(false); report.rapidReversal = { first, reversed, second };
  await press(); await expected(true);
  await evaluate("document.querySelector('.portrait-hold').dispatchEvent(new PointerEvent('pointercancel', {pointerId:window.__lastPointer,bubbles:true}))");
  await expected(false); await release(); report.pointerCancel = true;
  await press(); await expected(true);
  await evaluate("document.querySelector('.portrait-hold').releasePointerCapture(window.__lastPointer)");
  await mouse('mouseMoved', p.x+1, p.y, 1); await expected(false); await release(); report.lostCapture = true;
  await press(); await expected(true); await evaluate("window.dispatchEvent(new Event('blur'))");
  await expected(false); await release(); report.windowBlur = true;
  await press(); await expected(true);
  await evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'))");
  await expected(false,false);
  await evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))");
  await pause(100); await release(); await expected(false); report.visibilityReset = true;
  for (const value of ['Enter',' ']) {
    await evaluate("document.querySelector('.portrait-hold').focus()");
    await key('rawKeyDown',value); await expected(true);
    await key('rawKeyDown',value,true); assert((await revealState()).progress > .98);
    await key('keyUp',value); await expected(false);
  }
  report.keyboardHoldAndRepeat = true;
  await key('rawKeyDown',' '); await expected(true);
  await evaluate("document.querySelector('.header-cta').focus()"); await expected(false);
  await key('keyUp',' '); report.controlBlur = true;
  await evaluate("document.querySelector('.portrait-toggle').focus();document.querySelector('.portrait-toggle').click()");
  assert((await expected(true)).latched); await pause(600); assert((await revealState()).requested);
  await evaluate("document.querySelector('.portrait-toggle').click()"); await expected(false); report.toggle = true;
  await evaluate("document.querySelector('.portrait-toggle').focus();document.querySelector('.portrait-toggle').click()");
  await expected(true); await press(); assert(!(await expected(true)).latched); await release(); await expected(false); report.holdOverridesToggle = true;
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor("!document.querySelector('.hologram-canvas canvas')");
  await press(); await pause(40); report.reducedHold = await expected(true,false); assert(report.reducedHold.progress===1);
  await release(); await pause(40); assert((await expected(false,false)).progress===0); report.reducedRelease = true;
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await viewport(390,true);
  await call('Page.navigate', { url: 'http://localhost:3001/?check=touch' });
  await waitFor("!document.querySelector('.portrait-hold').disabled && [...document.querySelectorAll('.hologram-fallback img')].every(i=>i.complete&&i.naturalWidth)");
  await evaluate("document.querySelector('.portrait-hold').scrollIntoView({block:'center',behavior:'instant'})");
  await pause(500); await expected(false); await shot('mobile-digital');
  const touch = await center();
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touch.x,y:touch.y,id:0,radiusX:2,radiusY:2,force:.5}]});
  report.touchHold=await expected(true); await shot('mobile-real');
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await expected(false); report.touchRelease=true;
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touch.x,y:touch.y,id:0}]}); await expected(true);
  await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); await expected(false); report.touchCancel=true;
  assert(await evaluate("getComputedStyle(document.querySelector('.portrait-hold')).touchAction.includes('pan-y')"));
  assert(!await evaluate('document.documentElement.scrollWidth>innerWidth'));
  await viewport(1440);
  const unsupported=await call('Page.addScriptToEvaluateOnNewDocument',{source:`(() => { const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:get.call(this,type,...args);}; })();`});
  await call('Page.navigate',{url:'http://localhost:3001/?check=no-webgl'});
  await waitFor("!document.querySelector('.portrait-hold').disabled && [...document.querySelectorAll('.hologram-fallback img')].every(i=>i.complete&&i.naturalWidth)");
  await pause(300); assert(!await evaluate("!!document.querySelector('.hologram-canvas canvas')"));
  await press(); report.noWebglHold=await expected(true); await release(); await expected(false);
  await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:unsupported.identifier});
  assert.equal(errors.length,0,JSON.stringify(errors));
  report.errors=errors;report.externalRequests=[...new Set(requests.filter(url=>/^https?:/.test(url)&&!url.startsWith('http://localhost:3001')))];
  assert.equal(report.externalRequests.length,0);
  await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally { await call('Page.close').catch(() => {}); socket.close(); }
