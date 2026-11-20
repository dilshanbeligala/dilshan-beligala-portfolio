/** Run against a local Next.js build and an isolated Chrome remote debugging session. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const origin = process.env.PORTFOLIO_URL ?? "http://localhost:3031";
const debuggerUrl = process.env.PORTFOLIO_CHROME ?? "http://127.0.0.1:9234";
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
const viewport = (width, height, mobile = false) =>
  send("Emulation.setDeviceMetricsOverride", { width, height, mobile, deviceScaleFactor: 1 });
const media = (theme, motion = "no-preference") => send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-color-scheme", value: theme }, { name: "prefers-reduced-motion", value: motion }],
});
const go = selector => js(`void document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'start', behavior: 'instant' })`);
const rows = "#services .service-row";
const featured = ".service-row[data-featured]";
const hasSection = "document.querySelector('#services')";
const navSelector = ".desktop-nav a[href='#services']";
const scrollPosition = `(${hasSection}?.getBoundingClientRect().top ?? 100000)`;

async function screenshot(name) {
  if (!output) return;
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(output, `${name}.png`), Buffer.from(data, "base64"));
}
async function space() {
  const key = { key: " ", code: "Space", windowsVirtualKeyCode: 32 };
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
}

try {
  if (output) await mkdir(output, { recursive: true });
  await send("Page.enable");
  await send("Runtime.enable");
  await viewport(1440, 900);
  await media("dark");
  await send("Page.navigate", { url: origin });
  await until(`!!${hasSection}`);
  assert.equal(await js("document.querySelector('#ai-engineering').nextElementSibling.id"), "services");
  assert.equal(await js(`${hasSection}.nextElementSibling.id`), "testimonials");
  assert.equal(await js(`document.querySelectorAll(${JSON.stringify(rows)}).length`), 14);
  assert.equal(await js(`[...document.querySelectorAll(${JSON.stringify(rows + " summary")})].every(summary => summary.getAttribute('aria-controls') === summary.nextElementSibling.id)`), true);
  await go("#ai-engineering");
  await until("document.querySelector('.desktop-nav .active')?.hash === '#ai-engineering'");
  await go(featured);
  await until(`document.querySelector(${JSON.stringify(navSelector)}).getAttribute('aria-current') === 'location'`);
  await go("#ai-engineering");
  await until("document.querySelector('.desktop-nav .active')?.hash === '#ai-engineering'");
  await js(`void document.querySelector(${JSON.stringify(navSelector)}).click()`);
  await until(`location.hash === '#services' && ${scrollPosition} < 160`);
  await until(`document.querySelector(${JSON.stringify(navSelector)}).getAttribute('aria-current') === 'location'`);
  assert.ok(await js(`${scrollPosition} >= document.querySelector('.site-header').getBoundingClientRect().bottom`));
  await until("document.querySelector('.services-intro').hasAttribute('data-service-revealed')");
  await delay(650);
  await screenshot("desktop");

  await go(featured);
  const point = await js(`(() => { const r = document.querySelector('${featured} summary').getBoundingClientRect(); return { x: r.left + 130, y: r.top + 30 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await until("getComputedStyle(document.querySelector('.service-flow-preview')).opacity === '1'");
  await screenshot("ai-preview");
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await js(`void document.querySelector('${featured} summary').focus()`);
  await until("getComputedStyle(document.querySelector('.service-flow-preview')).opacity === '1'");
  await space();
  await until(`document.querySelector('${featured}').open`);
  assert.deepEqual(await js("[...document.querySelectorAll('.service-flow-details li')].map(node => node.textContent)"), ["Plan", "Develop", "Debug", "Test", "Review", "Deliver"]);
  await js("void document.querySelector('.theme-switcher-desktop input[value=light]').click()");
  await until("document.documentElement.dataset.theme === 'light'");
  assert.equal(await js(`document.querySelector('${featured}').open`), true);
  await screenshot("light-expanded");
  await js("void document.querySelector('#services .service-row summary').click()");
  await until("document.querySelectorAll('#services details[open]').length === 1 && document.querySelector('#services .service-row').open");
  await js("void document.querySelector('#services .service-row summary').focus()");
  await space();
  await until("document.querySelectorAll('#services details[open]').length === 0");

  for (const [width, height] of [[1920,1080],[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800],[320,568]]) {
    await viewport(width, height, width <= 390);
    await until(`innerWidth === ${width}`);
    assert.equal(await js(`(() => {
      if (document.documentElement.scrollWidth !== document.documentElement.clientWidth) return false;
      return [...document.querySelectorAll('#services summary')].every(row => {
        const label = row.querySelector('.service-label').getBoundingClientRect();
        const arrow = row.querySelector('.service-arrow').getBoundingClientRect();
        return label.right <= arrow.left + .5 && row.getBoundingClientRect().height >= 44;
      });
    })()`), true, `Services layout at ${width}×${height}`);
    console.log(`Passed layout at ${width}×${height}`);
  }
  await js("void document.querySelector('.site-header .menu-toggle').click()");
  await until("document.querySelector('#mobile-navigation').open");
  await js("void document.querySelector('#mobile-navigation a[href=\"#services\"]').click()");
  await until(`!document.querySelector('#mobile-navigation').open && ${scrollPosition} < 155`);
  await screenshot("mobile");
  await js(`void document.querySelector('${featured} summary').click()`);
  await until(`document.querySelector('${featured}').open`);
  assert.equal(await js("getComputedStyle(document.querySelector('.service-flow-preview')).display"), "none");

  await media("light", "reduce");
  await until("getComputedStyle(document.querySelector('.services-intro h2 > span > span')).animationName === 'none'");
  assert.equal(await js("document.querySelector('.services-actions a:last-child').getAttribute('href')"), "mailto:beligaladilshan@gmail.com");
  await go(".services-actions a:first-child");
  await js("void document.querySelector('.services-actions a:first-child').click()");
  await until("location.hash === '#contact' && document.querySelector('#contact').getBoundingClientRect().top < 145");
  await js("void history.back()");
  await until("location.hash === '#services'");
  assert.deepEqual(errors, []);
  console.log("Passed navigation, disclosures, keyboard, AI preview, theme, reduced motion, CTA and browser history.");
} finally {
  socket.close();
  await fetch(`${debuggerUrl}/json/close/${page.id}`);
}
