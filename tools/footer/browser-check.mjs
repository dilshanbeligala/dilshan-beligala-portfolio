/** Run against a local Next.js build and an isolated Chrome remote debugging session. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const origin = process.env.PORTFOLIO_URL ?? "http://localhost:3013";
const debuggerUrl = process.env.PORTFOLIO_CHROME ?? "http://127.0.0.1:9232";
const output = process.env.PORTFOLIO_SCREENSHOTS;

const page = await (await fetch(`${debuggerUrl}/json/new?about:blank`, { method: "PUT" })).json();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const pending = new Map(), errors = [];
let id = 0;
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown" || (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")) errors.push(message.params);
  const task = pending.get(message.id);
  if (!task) return;
  clearTimeout(task.timer);
  pending.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => {
    pending.delete(requestId);
    reject(new Error(`Chrome did not complete ${method}`));
  }, 12000).unref();
  pending.set(requestId, { resolve, reject, timer });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
async function js(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function until(condition) {
  for (let attempt = 0; attempt < 140; attempt++) {
    if (await js(condition)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${condition}`);
}
const field = "document.querySelector('.footer-word-field')";
const words = "document.querySelectorAll('.footer-word[data-placed]')";
const goTo = fraction => js(`void scrollBy({ top: ${field}.getBoundingClientRect().top - innerHeight * ${fraction}, behavior: 'instant' })`);
const viewport = (width, height, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width, height, mobile, deviceScaleFactor: 1 });
const media = (theme, motion = "no-preference") => send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-color-scheme", value: theme }, { name: "prefers-reduced-motion", value: motion }],
});

async function sample(frameCount, minimumCount, fallback = false) {
  const result = await js(`(() => {
    const field = ${field};
    const identity = document.querySelector('.footer-identity');
    const nodes = [...( ${fallback} ? field.children : ${words})].filter(node => getComputedStyle(node).display !== 'none');
    const controllers = [...identity.querySelectorAll('a')];
    const gap = ${fallback} ? parseFloat(getComputedStyle(field).gap) : Number(field.dataset.gap);
    let remaining = ${frameCount}, minGap = Infinity;
    let resolve;
    function check() {
      const container = field.getBoundingClientRect();
      const boxes = nodes.map(node => node.getBoundingClientRect());
      const other = [identity.getBoundingClientRect(), ...controllers.map(node => node.getBoundingClientRect())];
      const clearance = (a, b) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) return resolve({ error: 'horizontal overflow',
        width: document.documentElement.scrollWidth,
        nodes: [...document.querySelectorAll('body *')].filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.right > document.documentElement.clientWidth + .5 && rect.width > 0 && getComputedStyle(node).position !== 'fixed';
        }).slice(0, 8).map(node => String(node.className))
      });
      for (const [index, box] of boxes.entries()) {
        const label = nodes[index].textContent;
        if (box.left < container.left - .5 || box.right > container.right + .5 || box.top < container.top - .5 || box.bottom > container.bottom + .5) return resolve({ error: 'outside container', label });
        if (other.some(control => clearance(control, box) < 0)) return resolve({ error: 'identity overlap', label });
        for (let next = index + 1; next < boxes.length; next++) {
          const distance = clearance(box, boxes[next]);
          minGap = Math.min(minGap, distance);
          if (distance < gap - .5) return resolve({ error: 'word spacing', label, other: nodes[next].textContent, distance, gap });
        }
      }
      if (--remaining) requestAnimationFrame(check);
      else resolve({ count: nodes.length, minGap, gap });
    }
    if (${fallback}) {
      let result;
      resolve = value => { result = value; };
      check();
      return result;
    }
    return new Promise(done => {
      resolve = done;
      requestAnimationFrame(check);
    });
  })()`);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.ok(result.count >= minimumCount, JSON.stringify(result));
  return result;
}

async function screenshot(name) {
  if (!output) return;
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(output, `${name}.png`), Buffer.from(data, "base64"));
}

try {
  if (output) await mkdir(output, { recursive: true });
  await send("Page.enable");
  await send("Runtime.enable");
  await viewport(1440, 900);
  await media("dark");
  await send("Page.navigate", { url: origin });
  await until(`${field}?.hasAttribute('data-packed')`);
  await js("document.fonts.ready.then(() => true)");

  for (const [width, height] of [[1920,1080],[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800],[320,568]]) {
    await viewport(width, height, width <= 390);
    await until(`innerWidth === ${width}`);
    await goTo(.73);
    await delay(70);
    const minimum = width >= 1280 ? 50 : width >= 768 ? 27 : 14;
    const entry = await sample(10, minimum);
    await goTo(.17);
    const motion = sample(36, minimum);
    for (let i = 0; i < 16; i++) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 25 + ((i * 227) % (width - 50)), y: Math.round(height * .42) });
      await delay(16);
    }
    const immersive = await motion;
    await goTo(.73);
    const reversal = await sample(10, minimum);
    console.log(`${width}×${height} · ${immersive.count} words · ${Math.min(entry.minGap, immersive.minGap, reversal.minGap).toFixed(1)}px minimum observed gap`);
    if (width === 1440 || width === 390) {
      await goTo(.12);
      await screenshot(`field-${width}`);
    }
  }

  await viewport(1440, 900);
  await goTo(.9);
  await js(`void scrollBy({ top: ${field}.getBoundingClientRect().top - innerHeight * .16, behavior: 'smooth' })`);
  await sample(34, 15);
  await goTo(.12);
  const order = await js(`[...${words}].map(node => [node.textContent, node.style.left, node.style.top])`);
  await js("void document.querySelector('.theme-switcher-desktop input[value=light]').click()");
  await until("document.documentElement.dataset.theme === 'light'");
  assert.deepEqual(await js(`[...${words}].map(node => [node.textContent, node.style.left, node.style.top])`), order);
  await sample(16, 15);
  const point = await js(`(() => {
    const box = ${words}[0].getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await until(`parseFloat(${words}[0].style.getPropertyValue('--word-glow')) > 10`);
  await sample(10, 15);
  await screenshot("field-light");

  const other = await (await fetch(`${debuggerUrl}/json/new?about:blank`, { method: "PUT" })).json();
  try {
    await until("document.hidden");
    const pose = await js(`[...${words}].map(node => node.style.transform)`);
    await delay(250);
    assert.deepEqual(await js(`[...${words}].map(node => node.style.transform)`), pose);
  } finally {
    await send("Page.bringToFront");
    await fetch(`${debuggerUrl}/json/close/${other.id}`);
  }
  await until("!document.hidden");
  await sample(10, 15);

  await js("void scrollTo({top: document.documentElement.scrollHeight, behavior:'instant'})");
  await until("parseFloat(document.querySelector('.footer-progress-value').style.strokeDashoffset) < 1");
  await screenshot("identity");
  assert.deepEqual(await js("[...document.querySelectorAll('.engineering-footer .footer-social-links a')].map(a => [a.href, a.target, a.rel])"), [
    ["https://www.linkedin.com/in/dilshanbeligala/", "_blank", "noopener noreferrer"],
    ["https://github.com/dilshanbeligala", "_blank", "noopener noreferrer"],
    ["https://www.facebook.com/chamika.dilshan.568", "_blank", "noopener noreferrer"],
    ["mailto:beligaladilshan@gmail.com", "", ""],
    ["https://wa.me/94755772582", "_blank", "noopener noreferrer"],
  ]);

  await media("light", "reduce");
  await until(`[...${words}].every(node => !node.style.transform)`);
  await goTo(.15);
  await sample(10, 15);
  assert.equal(await js("getComputedStyle(document.documentElement).scrollBehavior"), "auto");
  await js("void document.querySelector('.footer-back-to-top').focus()");
  const enter = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 };
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...enter });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...enter });
  await until("location.hash === '#home' && scrollY === 0");

  await send("Page.navigate", { url: `${origin}/about` });
  await until("location.pathname === '/about' && document.querySelector('.footer-back-to-top')?.getAttribute('href') === '/#home'");
  await viewport(320, 568, true);
  await send("Emulation.setScriptExecutionDisabled", { value: true });
  await send("Page.navigate", { url: `${origin}/?static=footer` });
  await until(`location.search === '?static=footer' && !!${field}`);
  await until("document.fonts.status === 'loaded'");
  await goTo(.2);
  assert.equal(await js(`${field}.hasAttribute('data-packed')`), false);
  await sample(1, 6, true);
  assert.deepEqual(errors, []);
  console.log("Passed live layout, rapid pointer and scroll reversal, theme, tab pause, keyboard return, static fallback, and footer links.");
} finally {
  socket.close();
  await fetch(`${debuggerUrl}/json/close/${page.id}`);
}
