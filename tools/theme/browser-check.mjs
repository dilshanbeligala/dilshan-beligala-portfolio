/**
 * Production checks using the Chrome DevTools Protocol and Node 24.
 * Run against a local build with a separate Chrome debugging profile.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const origin = process.env.PORTFOLIO_URL ?? "http://localhost:3000";
const debuggerUrl = process.env.PORTFOLIO_CHROME ?? "http://127.0.0.1:9223";
const artifacts = process.env.PORTFOLIO_THEME_SCREENSHOTS;
const target = await fetch(`${debuggerUrl}/json/new?about:blank`, { method: "PUT" }).then(response => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (request) {
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`${request.method}: ${message.error.message} ${message.error.data ?? ""}`));
    else request.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params.exceptionDetails);
  } else if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    errors.push(message.params.entry.text);
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evalPage(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true }).catch(error => {
    throw new Error(`Unable to evaluate ${expression}`, { cause: error });
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 75; attempt++) {
    if (await evalPage(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${expression}`);
}
async function viewport(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}
function media(scheme, motion = "no-preference") {
  return send("Emulation.setEmulatedMedia", { features: [
    { name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: motion },
  ] });
}
async function go(path, theme, ready = true) {
  const previous = await evalPage("performance.timeOrigin");
  await send("Page.navigate", { url: new URL(path, origin).href });
  await waitFor(`performance.timeOrigin!==${previous} && location.pathname===${JSON.stringify(path)} && document.readyState==="complete"
    ${theme ? `&& document.documentElement.dataset.theme===${JSON.stringify(theme)}` : ""}`);
  if (ready) await waitFor("document.querySelector('.constellation-surface')?.width > 1");
}
function choose(value, placement = "desktop") {
  return evalPage(`document.querySelector('.theme-switcher-${placement} input[value=${value}]').click()`);
}
function selected(placement = "desktop") {
  return evalPage(`document.querySelector('.theme-switcher-${placement} input:checked')?.value`);
}
async function checkLayout() {
  assert(await evalPage(`document.documentElement.scrollWidth===innerWidth &&
    document.querySelectorAll(".constellation-surface").length===1`));
}
async function screenshot(name) {
  if (!artifacts) return;
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(artifacts, `${name}.png`), Buffer.from(data, "base64"));
}

const contrastSource = `(() => {
  function luminance(channels) {
    return channels.slice(0,3).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [.2126,.7152,.0722][index], 0);
  }
  function ratio(color, background) {
    const values = [color, background].map(text => luminance(text.match(/[\\d.]+/g).map(Number))).sort((a,b)=>b-a);
    return Number(((values[0]+.05)/(values[1]+.05)).toFixed(2));
  }
  const css=element=>getComputedStyle(document.querySelector(element));
  const page=css("body"), stat=css(".engineering-stat"), number=css(".engineering-stat dd"), label=css(".engineering-stat dt");
  const primary=css(".button-primary"), selected=css(".theme-switcher-desktop input:checked + span");
  const focus=getComputedStyle(document.querySelector(".skip-link")).backgroundColor;
  return {
    body: ratio(page.color,page.backgroundColor), stat: ratio(number.color,stat.backgroundColor),
    statLabel: ratio(label.color,stat.backgroundColor), primary: ratio(primary.color,primary.backgroundColor),
    selected: ratio(selected.color,selected.backgroundColor),
    focus: ratio(focus,page.backgroundColor)
  };
})()`;

try {
  if (artifacts) await mkdir(artifacts, { recursive: true });
  for (const domain of ["Page", "Runtime", "Log", "Network"]) await send(`${domain}.enable`);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    document.addEventListener('DOMContentLoaded',()=>{window.initialTheme=document.documentElement.dataset.theme});
    window.neural={clears:0,strokes:0,palette:[],positions:[]};
    const canvas=CanvasRenderingContext2D.prototype;
    for(const name of ['clearRect','stroke','arc']){
      const original=canvas[name];
      canvas[name]=function(...args){
        if(this.canvas.matches('.constellation-surface')){
          if(name==='clearRect'){neural.clears++;neural.strokes=0;neural.palette=[];neural.positions=[];}
          if(name==='stroke'){neural.strokes++;neural.palette.push(this.strokeStyle);}
          if(name==='arc')neural.positions.push(args.slice(0,2));
        }
        return original.apply(this,args);
      };
    }
  ` });
  await viewport(1440, 900);
  await media("dark");
  await go("/", null);
  await evalPage("localStorage.removeItem('portfolio-theme')");
  await go("/", "dark");
  assert.equal(await selected(), "system");
  await media("light");
  await waitFor("document.documentElement.dataset.theme==='light'");
  assert.equal(await selected(), "system");
  await choose("dark");
  await waitFor("localStorage.getItem('portfolio-theme')==='dark'");
  await go("/about", "dark");
  assert.equal(await selected(), "dark");
  await media("dark");
  await choose("light");
  await waitFor("localStorage.getItem('portfolio-theme')==='light'");
  await go("/", "light");
  assert.equal(await selected(), "light");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    const blockedStorage=()=>{throw new DOMException('Unavailable','SecurityError')};
    Object.defineProperty(window,"localStorage",{get:blockedStorage, configurable:true});
  ` }).then(async ({ identifier }) => {
    await go("/about", "dark");
    assert.equal(await selected(), "system");
    await choose("light");
    await waitFor("document.documentElement.dataset.theme==='light'");
    assert.equal(await selected(), "light");
    await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  });
  await go("/", "light");
  await waitFor("document.querySelector('.code-rain[data-ready]') && document.querySelector('.hologram-ready')");
  await delay(1300);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 650, y: 520 });
  await waitFor("window.neural.strokes>4 && document.documentElement.hasAttribute('data-white-pointer')");
  await delay(950);
  const lightPositions = await evalPage("neural.positions");
  const lightInk = await evalPage("neural.palette");
  assert(lightInk.some(color => ["#086a86", "#6543ac", "#47619c"].includes(color)));
  await evalPage(`window.beforeTheme={
    scroll:scrollY, field:document.querySelector('.constellation-surface'), 
    code:document.querySelector('.code-rain'), webgl:document.querySelector('.hologram-canvas canvas')
  }; true`);
  const ring = `getComputedStyle(document.querySelector(".white-pointer"),"::before").borderTopColor`;
  assert.equal(await evalPage(ring), "rgb(19, 44, 70)");
  await choose("dark");
  await waitFor("neural.palette.some(color => ['#49e5ff','#ae91ff','#9cb5ff'].includes(color))");
  assert.equal(await evalPage(ring), "rgb(255, 255, 255)");
  const darkPositions = await evalPage("neural.positions");
  assert.equal(darkPositions.length, lightPositions.length);
  const maxDrift = Math.max(...darkPositions.map(([x, y], index) =>
    Math.hypot(x - lightPositions[index][0], y - lightPositions[index][1])));
  assert(maxDrift < .25, `Constellation drifted ${maxDrift}px on theme change`);
  assert(await evalPage(`beforeTheme.scroll===scrollY && beforeTheme.field===document.querySelector('.constellation-surface') &&
    beforeTheme.code===document.querySelector('.code-rain') && beforeTheme.webgl===document.querySelector('.hologram-canvas canvas')`));
  await evalPage("window.dispatchEvent(new PointerEvent('pointerout',{pointerType:'mouse'}))");
  await waitFor("neural.strokes===0");
  await evalPage("document.querySelector('.theme-switcher-desktop input:checked').focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  await waitFor("localStorage.getItem('portfolio-theme')==='system'");
  assert(await evalPage("document.activeElement.matches('.theme-switcher-desktop input:focus-visible')"));

  const contrast = {};
  for (const scheme of ["dark", "light"]) {
    await choose(scheme);
    await waitFor(`document.documentElement.dataset.theme === '${scheme}' &&
      !document.documentElement.hasAttribute('data-theme-transition') &&
      ![...document.querySelectorAll('body, .engineering-stat, .button-primary, .theme-switcher')]
        .some(element => element.getAnimations().some(animation => animation instanceof CSSTransition && (animation.pending || animation.playState === 'running')))`);
    contrast[scheme] = await evalPage(contrastSource);
    for (const [label,value] of Object.entries(contrast[scheme])) assert(value >= (label === "focus" ? 3 : 4.5), `${scheme} ${label}: ${value}`);
    await evalPage("document.querySelector('.portrait-toggle').scrollIntoView({block:'center'}); document.querySelector('.portrait-toggle').click()");
    await waitFor("document.querySelector('.hologram-art').dataset.revealed==='true'");
    await evalPage("document.querySelector('.portrait-toggle').click()");
    await waitFor("document.querySelector('.hologram-art').dataset.revealed==='false'");
  }

  await media("dark", "reduce");
  await choose("dark");
  await waitFor("!document.documentElement.hasAttribute('data-theme-transition')");
  assert(await evalPage("!document.documentElement.hasAttribute('data-white-pointer')"));
  await media("dark");
  // Block the framework bundles and verify the saved theme is already rendered.
  await send("Network.setBlockedURLs", { urls: ["*/_next/static/*.js*"] });
  await evalPage("localStorage.setItem('portfolio-theme','light')");
  await go("/about", "light", false);
  assert.equal(await evalPage("window.initialTheme"), "light");
  assert.equal(await evalPage("getComputedStyle(document.body).backgroundColor"), "rgb(246, 248, 252)");
  assert.equal(await evalPage("document.querySelector('.constellation-surface').width"), 1);
  await evalPage("localStorage.setItem('portfolio-theme','dark')");
  await go("/", "dark", false);
  assert.equal(await evalPage("window.initialTheme"), "dark");
  assert.equal(await evalPage("getComputedStyle(document.body).backgroundColor"), "rgb(5, 6, 11)");
  assert.equal(await evalPage("document.querySelector('.constellation-surface').width"), 1);
  await send("Network.setBlockedURLs", { urls: [] });

  for (const [size,width,height] of [["desktop",1440,900],["tablet",768,1024],["mobile",390,844]]) {
    await viewport(width,height,size==="mobile");
    for (const scheme of ["dark","light"]) {
      await evalPage(`localStorage.setItem('portfolio-theme','${scheme}')`);
      await go("/",scheme);
      await checkLayout();
      await delay(size === "desktop" ? 2500 : 1300);
      if (size === "desktop") {
        const [x,y] = await evalPage(`(() => {
          const source=document.querySelector(".name [data-glitch-source]"), walker=document.createTreeWalker(source,NodeFilter.SHOW_TEXT);
          const text=walker.nextNode(), range=document.createRange();
          range.setStart(text,0); range.setEnd(text,1);
          const rect=range.getBoundingClientRect();
          return [rect.left+rect.width/2,rect.top+rect.height/2];
        })()`);
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 60, y: 150 });
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await waitFor("document.querySelector('.glitch-slot[style]')");
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 60, y: 150 });
        await delay(450);
      }
      for (const [name, selector] of Object.entries({
        hero: "#home", bio: "#about", statistics: ".engineering-stats", experience: "#experience",
        projects: ".home-project-card", ai: "#ai-engineering", contact: "#contact", footer: "footer",
      })) {
        if (name !== "hero") await evalPage(`document.querySelector('${selector}').scrollIntoView()`);
        await delay(90);
        await screenshot(`${size}-${scheme}-${name}`);
      }
      assert(await evalPage("document.querySelector('#contact a').href.includes('linkedin.com')"));
      if (size !== "desktop") {
        await evalPage("document.querySelector('.site-header .menu-toggle').click()");
        await waitFor("document.querySelector('.mobile-menu').open");
        assert.equal(await selected("mobile"),scheme);
        await delay(660);
        await screenshot(`${size}-${scheme}-navigation`);
        const alternate = scheme === "dark" ? "light" : "dark";
        const scroll = await evalPage("scrollY");
        await choose(alternate,"mobile");
        await waitFor(`document.documentElement.dataset.theme==='${alternate}'`);
        assert.equal(await evalPage("scrollY"),scroll);
        await choose(scheme,"mobile");
        await evalPage("document.querySelector('.mobile-top button').click()");
        await waitFor("!document.querySelector('.mobile-menu').open");
      }
      await go("/about",scheme);
      await checkLayout();
      await delay(1300);
      await screenshot(`${size}-${scheme}-about`);
      for (const [name,selector] of [["career",".about-efito"],["project",".about-project"],["closing",".about-closing"]]) {
        await evalPage(`document.querySelector('${selector}').scrollIntoView()`);
        await delay(90);
        await screenshot(`${size}-${scheme}-about-${name}`);
      }
    }
  }

  await send("Page.getNavigationHistory").then(async ({ entries,currentIndex }) => {
    const previous = entries[currentIndex-1];
    await send("Page.navigateToHistoryEntry",{ entryId: previous.id });
    await waitFor("document.readyState==='complete' && location.pathname==='/' && document.documentElement.dataset.theme==='light'");
    await send("Page.navigateToHistoryEntry",{ entryId: entries[currentIndex].id });
    await waitFor("document.readyState==='complete' && location.pathname==='/about' && document.documentElement.dataset.theme==='light'");
  });
  assert.deepEqual(errors.filter(error => typeof error !== "string" || !error.includes("ERR_BLOCKED_BY_CLIENT")), []);
  console.log(JSON.stringify({ contrast, browser: "Chrome", viewports: [1440,768,390], schemes: ["dark","light"] }, null, 2));
} finally {
  await fetch(`${debuggerUrl}/json/close/${target.id}`);
  socket.close();
}
