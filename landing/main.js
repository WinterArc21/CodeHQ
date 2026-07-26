/* ==========================================================================
   HQ — landing page runtime
   1. WebGL hero shader (living graph paper, ghost topology, pulses)
   2. Interactive workflow canvas demo (real generate-video workflow data)
   3. UI: copy, header, rail, reveals, progress, ticks
   ========================================================================== */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   1. HERO SHADER
   ========================================================================== */

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;   // uv, y-up
uniform float uMAct;    // mouse activity 0..1
out vec4 frag;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float gridLine(vec2 q){
  vec2 d = abs(fract(q - 0.5) - 0.5) / fwidth(q);
  return 1.0 - min(min(d.x, d.y), 1.0);
}
float sdBox(vec2 p, vec2 c, vec2 b){
  vec2 d = abs(p - c) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdSeg(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float stroke(float d, float wpx){
  float aa = 1.5 / uRes.y;
  return 1.0 - smoothstep(wpx, wpx + aa, abs(d));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p  = vec2(uv.x * aspect, uv.y);
  vec2 m  = vec2(uMouse.x * aspect, uMouse.y);
  float md = length(p - m);
  float lens = exp(-md * md * 10.0) * uMAct;

  // gentle lens warp around the cursor
  vec2 w = uv + normalize(uv - uMouse + 1e-5) * (-lens * 0.006);
  vec2 px = w * uRes;

  // paper
  vec3 col = vec3(0.962, 0.949, 0.925);
  col *= 1.0 - 0.035 * uv.y;
  float vig = smoothstep(1.25, 0.35, length(uv - vec2(0.42, 0.55)));
  col *= mix(0.972, 1.0, vig);

  // technical grid
  vec3 lineC = vec3(0.796, 0.780, 0.745);
  float g1 = gridLine(px / 32.0);
  float g2 = gridLine(px / 128.0);
  float gA = 0.30 + 0.60 * lens;
  col = mix(col, lineC, clamp(g1 * 0.30 + g2 * 0.50, 0.0, 1.0) * gA);

  // ---- ghost topology -------------------------------------------------
  vec2 c0 = vec2(0.60 * aspect, 0.70), s0 = vec2(0.052 * aspect, 0.034);
  vec2 c1 = vec2(0.80 * aspect, 0.60), s1 = vec2(0.058 * aspect, 0.036);
  vec2 c2 = vec2(0.70 * aspect, 0.40), s2 = vec2(0.052 * aspect, 0.034);
  vec2 c3 = vec2(0.88 * aspect, 0.28), s3 = vec2(0.050 * aspect, 0.032);
  vec2 c4 = vec2(0.47 * aspect, 0.50), s4 = vec2(0.050 * aspect, 0.032);

  // edges: 4->0, 0->1, 4->2, 2->3
  float t0 = fract(uTime * 0.100 + 0.00);
  float t1 = fract(uTime * 0.085 + 0.35);
  float t2 = fract(uTime * 0.120 + 0.60);
  float t3 = fract(uTime * 0.095 + 0.15);

  vec3 AMBER = vec3(0.78, 0.58, 0.25);
  vec3 GREEN = vec3(0.29, 0.60, 0.44);
  vec3 BLUE  = vec3(0.33, 0.50, 0.86);

  // connection hairlines
  float conn = 0.0;
  conn += stroke(sdSeg(p, c4, c0), 0.0009);
  conn += stroke(sdSeg(p, c0, c1), 0.0009);
  conn += stroke(sdSeg(p, c4, c2), 0.0009);
  conn += stroke(sdSeg(p, c2, c3), 0.0009);
  col = mix(col, lineC, clamp(conn, 0.0, 1.0) * 0.35);

  // node boxes, flashed on pulse arrival
  float boxes = 0.0;
  boxes += stroke(sdBox(p, c0, s0), 0.0011) * (1.0 + 1.8 * smoothstep(0.93, 1.0, t0));
  boxes += stroke(sdBox(p, c1, s1), 0.0011) * (1.0 + 1.8 * smoothstep(0.93, 1.0, t1));
  boxes += stroke(sdBox(p, c2, s2), 0.0011) * (1.0 + 1.8 * smoothstep(0.93, 1.0, t2));
  boxes += stroke(sdBox(p, c3, s3), 0.0011) * (1.0 + 1.8 * smoothstep(0.93, 1.0, t3));
  boxes += stroke(sdBox(p, c4, s4), 0.0011);
  col = mix(col, vec3(0.42, 0.41, 0.39), clamp(boxes, 0.0, 1.0) * 0.30);

  // traveling pulses
  float glowR = 7.0 / uRes.y;
  vec2 q0 = mix(c4, c0, t0);
  vec2 q1 = mix(c0, c1, t1);
  vec2 q2 = mix(c4, c2, t2);
  vec2 q3 = mix(c2, c3, t3);
  float p0 = exp(-pow(length(p - q0) / glowR, 2.0));
  float p1 = exp(-pow(length(p - q1) / glowR, 2.0));
  float p2 = exp(-pow(length(p - q2) / glowR, 2.0));
  float p3 = exp(-pow(length(p - q3) / glowR, 2.0));
  col = mix(col, AMBER, p0 * 0.55);
  col = mix(col, GREEN, p1 * 0.55);
  col = mix(col, BLUE,  p2 * 0.55);
  col = mix(col, AMBER, p3 * 0.55);

  // cursor warmth
  col = mix(col, AMBER, exp(-md * md * 7.0) * 0.045 * uMAct);

  // film grain, 24fps stepped
  col += (hash21(gl_FragCoord.xy + floor(uTime * 24.0)) - 0.5) * 0.026;

  frag = vec4(col, 1.0);
}`;

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

function initHeroGL() {
  const canvas = document.getElementById("gl");
  const hero = canvas?.closest(".hero");
  if (!canvas || !hero) return;

  let gl = null;
  try {
    gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "low-power" });
  } catch { /* fall through to fallback */ }
  if (!gl) { canvas.style.display = "none"; return; }

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      canvas.style.display = "none";
      return null;
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = "none"; return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uMouse = gl.getUniformLocation(prog, "uMouse");
  const uMAct = gl.getUniformLocation(prog, "uMAct");

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
  const size = () => {
    const r = hero.getBoundingClientRect();
    canvas.width = Math.max(2, Math.round(r.width * DPR));
    canvas.height = Math.max(2, Math.round(r.height * DPR));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  size();
  new ResizeObserver(size).observe(hero);

  // smoothed mouse + activity envelope
  let mx = 0.62, my = 0.55, tx = mx, ty = my, act = 0, actTarget = 0, idleTimer = 0;
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width;
    ty = 1 - (e.clientY - r.top) / r.height;
    actTarget = 1;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { actTarget = 0; }, 1800);
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { actTarget = 0; }, { passive: true });

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(hero);

  const draw = (t) => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mx, my);
    gl.uniform1f(uMAct, act);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  if (REDUCED) { draw(3.7); return; }   // one static, well-composed frame

  let start = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    mx += (tx - mx) * 0.08;
    my += (ty - my) * 0.08;
    act += (actTarget - act) * 0.06;
    draw((now - start) / 1000);
  };
  requestAnimationFrame(loop);
}

/* ==========================================================================
   2. WORKFLOW CANVAS DEMO — real data from examples/motiona
   ========================================================================== */

const CAT_VAR = {
  entry: "var(--blue)", decision: "var(--amber)", logic: "var(--ink-3)",
  data: "var(--green)", external: "var(--violet)", output: "var(--green)",
};

const STEPS = [
  {
    id: "receive-request", idx: "01", name: "Receive Request", cat: "entry", conf: "verified",
    x: 3, y: 12.5, io: "url → GenerateRequestBody",
    purpose: "Accepts the website URL, optional reference images, and tone setting.",
    sources: [{ file: "app/api/generate/route.ts", symbol: "POST", line: "14–39" }],
    inputs: [], outputs: [{ name: "GenerateRequestBody" }], edgeCases: [], tests: [],
  },
  {
    id: "validate-request", idx: "02", name: "Validate Request", cat: "decision", conf: "verified",
    x: 25, y: 12.5, io: "GenerateRequestBody → validated",
    purpose: "Checks the URL and reference images, and normalizes the tone.",
    sources: [{ file: "lib/validation.ts", symbol: "validateGenerateRequest" }],
    inputs: [{ name: "GenerateRequestBody" }], outputs: [{ name: "ValidatedGenerateRequest" }],
    edgeCases: [
      { name: "Malformed or unreachable URL", handling: "Returns a 400 with an explanatory error message." },
      { name: "Too many reference images", handling: "Returns a 400 rejecting the request." },
    ],
    tests: [
      { symbol: "accepts a valid generation request", file: "tests/unit/lib/validation.test.ts", status: "passing" },
      { symbol: "rejects a malformed URL", file: "tests/unit/lib/validation.test.ts", status: "passing" },
    ],
  },
  {
    id: "check-quota", idx: "03", name: "Check Quota", cat: "decision", conf: "verified",
    x: 47, y: 12.5, io: "account → allow / 429",
    purpose: "Confirms the account has not exceeded its monthly generation quota.",
    sources: [{ file: "lib/validation.ts", symbol: "hasRemainingQuota" }],
    inputs: [], outputs: [],
    edgeCases: [{ name: "Monthly quota exceeded", handling: "Returns a 429." }],
    tests: [],
  },
  {
    id: "scrape-website", idx: "04", name: "Scrape Website", cat: "logic", conf: "verified",
    x: 69, y: 12.5, io: "request → ScrapedWebsite",
    purpose: "Fetches the submitted page and extracts its title, description, body text, and images.",
    sources: [{ file: "lib/scraper.ts", symbol: "scrapeWebsite" }],
    inputs: [{ name: "ValidatedGenerateRequest" }], outputs: [{ name: "ScrapedWebsite" }],
    edgeCases: [{ name: "Website unreachable or error status", handling: "Returns a 502 without persisting a generation." }],
    tests: [{ symbol: "extracts the title and description", file: "tests/unit/lib/scraper.test.ts", status: "passing" }],
  },
  {
    id: "understand-product", idx: "05", name: "Understand Product", cat: "logic", conf: "inferred",
    x: 69, y: 59, io: "ScrapedWebsite → ProductContext",
    purpose: "Converts the scraped page into a structured product model: name, tagline, summary, hero image, and keywords.",
    sources: [{ file: "lib/product-model.ts", symbol: "buildProductContext" }],
    inputs: [{ name: "ScrapedWebsite" }], outputs: [{ name: "ProductContext" }],
    edgeCases: [], tests: [],
    impl: "Ranks the most frequent non-trivial words in the body text as keywords, and assumes the first scraped image is representative of the product.",
    assumptions: ["The first image found on the page is a reasonable hero image."],
  },
  {
    id: "generate-story", idx: "06", name: "Generate Story", cat: "logic", conf: "verified",
    x: 47, y: 59, io: "ProductContext → StoryPlan",
    purpose: "Builds a short, tone-appropriate beat sequence (hook, problem, payoff) from the product context.",
    sources: [{ file: "lib/story.ts", symbol: "generateStoryPlan" }],
    inputs: [{ name: "ProductContext" }], outputs: [{ name: "StoryPlan" }],
    edgeCases: [], tests: [],
  },
  {
    id: "save-result", idx: "07", name: "Save Result", cat: "output", conf: "verified",
    x: 25, y: 59, io: "StoryPlan → 200 / error",
    purpose: "Persists the generation and returns it to the caller, or returns an error response for any failed step above.",
    sources: [
      { file: "lib/persistence.ts", symbol: "saveGeneration" },
      { file: "app/api/generate/route.ts", symbol: "POST" },
    ],
    inputs: [{ name: "StoryPlan" }], outputs: [],
    edgeCases: [], tests: [{ symbol: "returns the generated story plan", file: "tests/integration/api/generate.test.ts", status: "passing" }],
  },
];

const EDGES = [
  { from: "receive-request", to: "validate-request", type: "success" },
  { from: "validate-request", to: "check-quota", type: "success" },
  { from: "check-quota", to: "scrape-website", type: "success" },
  { from: "scrape-website", to: "understand-product", type: "success", route: "b2t" },
  { from: "understand-product", to: "generate-story", type: "success" },
  { from: "generate-story", to: "save-result", type: "success" },
  { from: "validate-request", to: "save-result", type: "failure", label: "rejected", route: "b2t" },
  { from: "check-quota", to: "save-result", type: "failure", label: "quota exceeded", route: "b2t" },
  { from: "scrape-website", to: "save-result", type: "conditional", label: "scrape failed", route: "elbow" },
];

const VB_W = 1000, VB_H = 560;

function cubicMid(p0, c1, c2, p1) {
  const t = 0.5, u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
  ];
}

function initDemo() {
  const canvas = document.getElementById("demoCanvas");
  const svg = document.getElementById("demoEdges");
  const nodesEl = document.getElementById("demoNodes");
  const drawer = document.getElementById("drawer");
  const hint = document.getElementById("demoHint");
  if (!canvas || !svg || !nodesEl || !drawer) return;

  /* ---- nodes ---- */
  const nodeEls = new Map();
  for (const s of STEPS) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "node" + (s.conf === "inferred" ? " is-inferred" : "");
    el.style.left = s.x + "%";
    el.style.top = s.y + "%";
    el.style.setProperty("--cat", CAT_VAR[s.cat]);
    el.dataset.id = s.id;
    el.setAttribute("aria-label", `Step ${s.idx}: ${s.name}`);
    el.setAttribute("aria-expanded", "false");
    el.innerHTML = `
      <span class="node-head">
        <span class="node-idx">${s.idx}</span>
        <span class="node-name">${s.name}</span>
        <span class="node-meta">${s.sources.length} src</span>
      </span>
      <span class="node-sub">${s.io}</span>
      ${s.conf === "inferred" ? '<span class="node-conf">inferred</span>' : ""}`;
    nodesEl.appendChild(el);
    nodeEls.set(s.id, el);
  }

  /* ---- edges (measured from real DOM rects, rebuilt on resize) ---- */
  const rectOf = (id) => {
    const el = nodeEls.get(id);
    const cw = nodesEl.clientWidth, ch = nodesEl.clientHeight;
    return {
      x: (el.offsetLeft / cw) * VB_W,
      y: (el.offsetTop / ch) * VB_H,
      w: (el.offsetWidth / cw) * VB_W,
      h: (el.offsetHeight / ch) * VB_H,
    };
  };

  const NS = "http://www.w3.org/2000/svg";

  const buildEdges = () => {
    svg.replaceChildren();

    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `
      <marker id="arr-n" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0 0 L8 4 L0 8 z" fill="oklch(0.798 0.016 85)"/>
      </marker>
      <marker id="arr-r" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0 0 L8 4 L0 8 z" fill="oklch(0.545 0.115 38)"/>
      </marker>
      <marker id="arr-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0 0 L8 4 L0 8 z" fill="oklch(0.665 0.115 72)"/>
      </marker>`;
    svg.appendChild(defs);

    let pulseIdx = 0;
    for (const e of EDGES) {
      const a = rectOf(e.from), b = rectOf(e.to);
      let d, labelAt = null;

      if (e.route === "elbow") {
        // circuit-style orthogonal route: down from source, left, up into target bottom
        const sx = a.x + a.w * 0.72, sy = a.y + a.h;
        const tx = b.x + b.w / 2, ty = b.y + b.h;
        const runY = VB_H * 0.87;
        d = `M ${sx} ${sy} L ${sx} ${runY} L ${tx} ${runY} L ${tx} ${ty + 4}`;
        labelAt = [(sx + tx) / 2, runY + 13];
      } else if (e.route === "b2t" || b.y > a.y + a.h) {
        // down: bottom of source -> top of target
        const p0 = [a.x + a.w / 2, a.y + a.h];
        const p1 = [b.x + b.w / 2, b.y];
        const dy = Math.max(60, (p1[1] - p0[1]) * 0.45);
        const c1 = [p0[0], p0[1] + dy], c2 = [p1[0], p1[1] - dy];
        d = `M ${p0[0]} ${p0[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p1[0]} ${p1[1]}`;
        const m = cubicMid(p0, c1, c2, p1);
        labelAt = [m[0] + 8, m[1] + 3];
      } else if (b.x >= a.x + a.w) {
        // forward: right of source -> left of target
        const p0 = [a.x + a.w, a.y + a.h / 2];
        const p1 = [b.x, b.y + b.h / 2];
        const dx = Math.max(36, (p1[0] - p0[0]) * 0.45);
        const c1 = [p0[0] + dx, p0[1]], c2 = [p1[0] - dx, p1[1]];
        d = `M ${p0[0]} ${p0[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p1[0]} ${p1[1]}`;
        labelAt = [(p0[0] + p1[0]) / 2, p0[1] - 8];
      } else {
        // backward: left of source -> right of target
        const p0 = [a.x, a.y + a.h / 2];
        const p1 = [b.x + b.w, b.y + b.h / 2];
        const dx = Math.max(36, (p0[0] - p1[0]) * 0.45);
        const c1 = [p0[0] - dx, p0[1]], c2 = [p1[0] + dx, p1[1]];
        d = `M ${p0[0]} ${p0[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p1[0]} ${p1[1]}`;
        labelAt = [(p0[0] + p1[0]) / 2, p0[1] - 8];
      }

      const marker = e.type === "failure" ? "arr-r" : e.type === "conditional" ? "arr-a" : "arr-n";

      const base = document.createElementNS(NS, "path");
      base.setAttribute("d", d);
      base.setAttribute("class", "edge" + (e.type === "failure" ? " is-failure" : e.type === "conditional" ? " is-conditional" : ""));
      base.setAttribute("marker-end", `url(#${marker})`);
      svg.appendChild(base);

      if (e.type !== "failure" && !REDUCED) {
        const pulse = document.createElementNS(NS, "path");
        pulse.setAttribute("d", d);
        pulse.setAttribute("class", "edge-pulse" + (e.type === "conditional" ? " is-conditional" : ""));
        pulse.setAttribute("pathLength", "100");
        svg.appendChild(pulse);
        const len = base.getTotalLength();
        pulse.style.animationDuration = `${Math.max(2.4, len / 130)}s`;
        pulse.style.animationDelay = `${-(pulseIdx++ * 0.9)}s`;
      }

      if (e.label && labelAt) {
        const t = document.createElementNS(NS, "text");
        t.setAttribute("x", String(labelAt[0]));
        t.setAttribute("y", String(labelAt[1]));
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("class", "edge-label" + (e.type === "failure" ? " is-failure" : " is-conditional"));
        t.textContent = e.label;
        svg.appendChild(t);
      }
    }
  };

  buildEdges();
  let resizeRaf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(buildEdges);
  }).observe(nodesEl);

  /* ---- drawer ---- */
  const dIdx = document.getElementById("dIdx");
  const dName = document.getElementById("dName");
  const dCat = document.getElementById("dCat");
  const dConf = document.getElementById("dConf");
  const dBody = document.getElementById("drawerBody");
  let selectedId = null;

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const renderDrawer = (s) => {
    dIdx.textContent = s.idx;
    dName.textContent = s.name;
    dCat.textContent = s.cat;
    dCat.style.setProperty("--badge-c", CAT_VAR[s.cat]);
    dConf.textContent = s.conf;
    dConf.classList.toggle("is-inferred", s.conf === "inferred");

    const sections = [];
    sections.push(`<div class="d-section"><span class="micro">Purpose</span><p class="d-purpose">${esc(s.purpose)}</p></div>`);

    if (s.sources.length) {
      sections.push(`<div class="d-section"><span class="micro">Sources</span>${
        s.sources.map((r) => `<div class="d-src">${esc(r.file)} · ${esc(r.symbol)}${r.line ? ` :${esc(r.line)}` : ""}</div>`).join("")
      }</div>`);
    }
    if (s.inputs.length) {
      sections.push(`<div class="d-section"><span class="micro">Inputs</span><div class="d-io">${
        s.inputs.map((i) => `<span class="d-chip">${esc(i.name)}</span>`).join("")
      }</div></div>`);
    }
    if (s.outputs.length) {
      sections.push(`<div class="d-section"><span class="micro">Outputs</span><div class="d-io">${
        s.outputs.map((o) => `<span class="d-chip out">${esc(o.name)}</span>`).join("")
      }</div></div>`);
    }
    if (s.edgeCases.length) {
      sections.push(`<div class="d-section"><span class="micro">Edge cases</span>${
        s.edgeCases.map((c) => `<div class="d-edge"><strong>${esc(c.name)}</strong><p class="d-hand">→ ${esc(c.handling)}</p></div>`).join("")
      }</div>`);
    }
    if (s.tests.length) {
      sections.push(`<div class="d-section"><span class="micro">Tests</span>${
        s.tests.map((t) => `<div class="d-test"><span class="dot${t.status === "unknown" ? " unknown" : ""}"></span><span>${esc(t.symbol)}<span class="file">${esc(t.file)}</span></span></div>`).join("")
      }</div>`);
    }
    if (s.impl) {
      sections.push(`<div class="d-section"><span class="micro">Implementation</span><p class="d-note">${esc(s.impl)}</p></div>`);
    }
    if (s.assumptions?.length) {
      sections.push(`<div class="d-section"><span class="micro">Assumptions</span>${
        s.assumptions.map((a) => `<p class="d-note" style="margin-bottom:6px">${esc(a)}</p>`).join("")
      }</div>`);
    }
    sections.push(`<p class="d-foot">marked ${s.conf} by agent · ${s.sources.length} source${s.sources.length === 1 ? "" : "s"} attached</p>`);
    dBody.innerHTML = sections.join("");
  };

  const openDrawer = (id) => {
    const s = STEPS.find((x) => x.id === id);
    if (!s) return;
    selectedId = id;
    renderDrawer(s);
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    for (const [nid, el] of nodeEls) {
      el.classList.toggle("is-selected", nid === id);
      el.setAttribute("aria-expanded", String(nid === id));
    }
    hint?.classList.add("is-hidden");
  };

  const closeDrawer = () => {
    selectedId = null;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    for (const el of nodeEls.values()) {
      el.classList.remove("is-selected");
      el.setAttribute("aria-expanded", "false");
    }
  };

  for (const [id, el] of nodeEls) {
    el.addEventListener("click", () => (selectedId === id ? closeDrawer() : openDrawer(id)));
  }
  document.getElementById("drawerClose")?.addEventListener("click", closeDrawer);
  canvas.addEventListener("click", (e) => {
    if (!(e.target instanceof Element) || !e.target.closest(".node")) closeDrawer();
  });
  document.getElementById("demo")?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeDrawer(); return; }
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const order = STEPS.map((s) => s.id);
    const cur = document.activeElement?.closest?.(".node")?.dataset?.id;
    const i = Math.max(0, order.indexOf(cur ?? order[0]));
    const next = order[(i + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length];
    nodeEls.get(next)?.focus();
    e.preventDefault();
  });

  /* ---- depth control ---- */
  const subOf = (s, depth) => {
    if (depth === "modules") {
      return `${s.sources.length} src · ${s.edgeCases.length} edge · ${s.tests.length} tests`;
    }
    if (depth === "symbols") {
      return s.sources.map((r) => r.symbol).join(" · ") || "—";
    }
    return s.io;
  };
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-on", b === btn));
      const depth = btn.dataset.depth ?? "workflow";
      for (const s of STEPS) {
        const sub = nodeEls.get(s.id)?.querySelector(".node-sub");
        if (sub) sub.textContent = subOf(s, depth);
      }
      buildEdges();
    });
  });

  /* ---- review button: small moment of honesty ---- */
  const review = document.getElementById("reviewBtn");
  review?.addEventListener("click", () => {
    review.classList.add("is-done");
    review.innerHTML = "Reviewed";
  }, { once: true });
}

/* ==========================================================================
   3. UI — copy, header, rail, reveals, progress, ticks
   ========================================================================== */

function initUI() {
  /* copy buttons */
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const label = btn.querySelector("span");
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy ?? "");
        btn.classList.add("is-copied");
        if (label) label.textContent = "copied";
        window.setTimeout(() => {
          btn.classList.remove("is-copied");
          if (label) label.textContent = "copy";
        }, 1400);
      } catch { /* clipboard unavailable — leave button as-is */ }
    });
  });

  /* header border on scroll */
  const head = document.getElementById("siteHead");
  const onScroll = () => head?.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* rail active section */
  const railLinks = new Map(
    [...document.querySelectorAll("[data-rail]")].map((a) => [a.dataset.rail, a]),
  );
  const sectionIO = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const key = en.target.dataset.section;
        for (const [k, a] of railLinks) a.classList.toggle("is-active", k === key);
      }
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  document.querySelectorAll("[data-section]").forEach((s) => sectionIO.observe(s));

  /* reveal fallback when scroll-driven animations are unavailable */
  if (!REDUCED && !CSS.supports("animation-timeline: view()")) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        }
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".section .reveal").forEach((el) => io.observe(el));
  }

  /* progress bar fallback when scroll timelines are unavailable */
  const progress = document.querySelector(".progress");
  if (progress && (REDUCED || !CSS.supports("animation-timeline: scroll()"))) {
    if (REDUCED) { progress.remove(); }
    else {
      const update = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      };
      window.addEventListener("scroll", update, { passive: true });
      update();
    }
  }

  /* fake-but-honest live snapshot ticker */
  const ticks = [...document.querySelectorAll("[data-tick]")];
  if (ticks.length && !REDUCED) {
    let seconds = 0;
    window.setInterval(() => {
      seconds += 15;
      const label = seconds < 45 ? "just now" : `${Math.floor(seconds / 60)}m ago`;
      for (const t of ticks) t.textContent = label;
    }, 15000);
  }
}

/* ---- boot ---- */
initHeroGL();
initDemo();
initUI();
