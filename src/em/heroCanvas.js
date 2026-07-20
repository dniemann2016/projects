/** Cinematic 3D-Engineering-Hero — Ingenieur am Laptop, rotierende Turbinen-Wireframes. */

const TAU = Math.PI * 2;

function rotY(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
function rotX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
function rotZ(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

function project(p, cam) {
  const z = p.z + cam.z;
  if (z < 0.1) return null;
  const s = cam.focal / z;
  return {
    x: cam.cx + p.x * s,
    y: cam.cy + p.y * s,
    z,
    s,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Turbinen-Rotor als 3D-Wireframe */
function buildTurbine() {
  const blades = 7;
  const hubR = 0.18;
  const tipR = 0.95;
  const segs = 24;
  const lines = [];

  for (let b = 0; b < blades; b++) {
    const ba = (b / blades) * TAU;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const r = lerp(hubR, tipR, t);
      const twist = t * 0.9;
      const p1 = { x: Math.cos(ba + twist) * r, y: (t - 0.5) * 0.35, z: Math.sin(ba + twist) * r };
      const p2 = {
        x: Math.cos(ba + twist + 0.08) * r,
        y: (t - 0.5) * 0.35 + 0.02,
        z: Math.sin(ba + twist + 0.08) * r,
      };
      lines.push([p1, p2]);
    }
    lines.push([
      { x: Math.cos(ba) * hubR, y: 0, z: Math.sin(ba) * hubR },
      { x: Math.cos(ba) * tipR, y: 0.15, z: Math.sin(ba) * tipR },
    ]);
  }

  for (const ry of [-0.12, 0, 0.12]) {
    const ring = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      ring.push({ x: Math.cos(a) * tipR, y: ry, z: Math.sin(a) * tipR });
    }
    for (let i = 0; i < ring.length - 1; i++) lines.push([ring[i], ring[i + 1]]);
  }

  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * TAU;
    const p1 = { x: Math.cos(a) * hubR, y: -0.08, z: Math.sin(a) * hubR };
    const p2 = { x: Math.cos(a) * hubR, y: 0.08, z: Math.sin(a) * hubR };
    lines.push([p1, p2]);
  }

  return lines;
}

/** Zahnrad-Wireframe */
function buildGear(teeth = 14, r = 0.35) {
  const lines = [];
  const inner = r * 0.55;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU;
    const a1 = ((i + 0.35) / teeth) * TAU;
    const a2 = ((i + 0.65) / teeth) * TAU;
    const a3 = ((i + 1) / teeth) * TAU;
    lines.push([
      { x: Math.cos(a0) * inner, y: 0, z: Math.sin(a0) * inner },
      { x: Math.cos(a1) * r, y: 0, z: Math.sin(a1) * r },
    ]);
    lines.push([
      { x: Math.cos(a1) * r, y: 0, z: Math.sin(a1) * r },
      { x: Math.cos(a2) * r, y: 0, z: Math.sin(a2) * r },
    ]);
    lines.push([
      { x: Math.cos(a2) * r, y: 0, z: Math.sin(a2) * r },
      { x: Math.cos(a3) * inner, y: 0, z: Math.sin(a3) * inner },
    ]);
  }
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const p1 = { x: Math.cos(a) * inner, y: 0, z: Math.sin(a) * inner };
    const p2 = { x: Math.cos(a + 0.05) * inner, y: 0, z: Math.sin(a + 0.05) * inner };
    lines.push([p1, p2]);
  }
  return lines;
}

export function mountHeroCanvas(canvas, opts = {}) {
  const { compact = false, strip = false } = opts;
  const ctx = canvas.getContext("2d");
  const turbineLines = buildTurbine();
  const gearLines = buildGear(12, 0.28);

  let w = 0;
  let h = 0;
  let scrollP = 0;
  let mouseX = 0.5;
  let mouseY = 0.5;
  let t = 0;
  let raf = 0;
  let typePhase = 0;
  let paused = false;
  let destroyed = false;

  const screenLines = [
    "Projekt: Turbinen-Retrofit",
    "Meilenstein M2 → Freigabe",
    "Team: Werkbank Vier",
    "Budget: 28.000 € · Treuhand",
    "NDA Stufe 2 ✓",
    "Pass-Score: 94%",
  ];

  const particles = Array.from({ length: 60 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
    sp: 0.0003 + Math.random() * 0.0008,
    size: 0.5 + Math.random() * 1.5,
  }));

  function resize() {
    if (destroyed || !canvas.isConnected) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawWireObject(lines, opts) {
    const {
      scale, ox, oy, rotXa, rotYa, rotZa, color, alpha = 1, lineW = 1,
    } = opts;
    const cam = {
      cx: ox * w,
      cy: oy * h,
      z: 2.8 + scrollP * 0.4,
      focal: Math.min(w, h) * scale,
    };

    const projected = [];
    for (const [a, b] of lines) {
      let pa = { ...a };
      let pb = { ...b };
      pa = rotX(pa, rotXa);
      pb = rotX(pb, rotXa);
      pa = rotY(pa, rotYa);
      pb = rotY(pb, rotYa);
      pa = rotZ(pa, rotZa);
      pb = rotZ(pb, rotZa);
      const pA = project(pa, cam);
      const pB = project(pb, cam);
      if (pA && pB) projected.push({ pA, pB, depth: (pA.z + pB.z) / 2 });
    }
    projected.sort((a, b) => b.depth - a.depth);

    for (const { pA, pB, depth } of projected) {
      const fade = Math.min(1, Math.max(0.15, 1.6 - depth * 0.35));
      ctx.strokeStyle = color.replace("ALPHA", String(alpha * fade));
      ctx.lineWidth = lineW * pA.s * 0.002;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }
  }

  function drawEngineerScene() {
    const baseX = w * (0.62 + (mouseX - 0.5) * 0.04);
    const baseY = h * (0.72 + scrollP * 0.08);
    const lapW = Math.min(w, h) * 0.22;
    const lapH = lapW * 0.62;
    const tilt = -0.12 + (mouseY - 0.5) * 0.04;

    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(tilt);

    // Schatten
    const sh = ctx.createRadialGradient(0, lapH * 0.5, 0, 0, lapH * 0.5, lapW * 0.8);
    sh.addColorStop(0, "rgba(0,113,227,0.25)");
    sh.addColorStop(1, "transparent");
    ctx.fillStyle = sh;
    ctx.fillRect(-lapW, -lapH * 0.2, lapW * 2, lapH * 1.2);

    // Person — minimalistische Silhouette (Seitenansicht)
    ctx.fillStyle = "rgba(20,20,24,0.95)";
    ctx.beginPath();
    ctx.ellipse(-lapW * 0.55, -lapH * 0.95, lapW * 0.14, lapW * 0.16, -0.2, 0, TAU);
    ctx.fill(); // Kopf
    ctx.beginPath();
    ctx.moveTo(-lapW * 0.75, -lapH * 0.75);
    ctx.quadraticCurveTo(-lapW * 0.5, -lapH * 0.3, -lapW * 0.15, -lapH * 0.05);
    ctx.lineTo(-lapW * 0.05, lapH * 0.15);
    ctx.lineTo(-lapW * 0.85, lapH * 0.1);
    ctx.closePath();
    ctx.fill(); // Körper
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-lapW * 0.35, -lapH * 0.45);
    ctx.quadraticCurveTo(-lapW * 0.05, -lapH * 0.35, lapW * 0.05, -lapH * 0.15);
    ctx.stroke(); // Arm zum Laptop

    // Laptop-Gehäuse
    const gBody = ctx.createLinearGradient(-lapW * 0.5, 0, lapW * 0.5, lapH);
    gBody.addColorStop(0, "#3a3a3c");
    gBody.addColorStop(1, "#1c1c1e");
    ctx.fillStyle = gBody;
    ctx.beginPath();
    ctx.roundRect(-lapW * 0.5, -lapH * 0.08, lapW, lapH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bildschirm (leuchtend)
    const sx = -lapW * 0.44;
    const sy = -lapH * 0.02;
    const sw = lapW * 0.88;
    const screenH = lapH * 0.78;
    const glow = ctx.createLinearGradient(sx, sy, sx + sw, sy + screenH);
    glow.addColorStop(0, "rgba(0,113,227,0.35)");
    glow.addColorStop(0.5, "rgba(41,151,255,0.55)");
    glow.addColorStop(1, "rgba(0,80,180,0.4)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, screenH, 4);
    ctx.fill();

    // Screen-Glow nach außen
    ctx.shadowColor = "rgba(0,113,227,0.6)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "rgba(0,113,227,0.08)";
    ctx.fillRect(sx - 20, sy - 10, sw + 40, screenH + 20);
    ctx.shadowBlur = 0;

    // Tipp-Animation auf dem Screen
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, screenH, 4);
    ctx.clip();
    ctx.font = `${Math.max(9, sw * 0.045)}px "SF Mono", Menlo, monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const visibleLines = Math.floor(typePhase) % (screenLines.length + 2);
    for (let i = 0; i <= visibleLines && i < screenLines.length; i++) {
      const line = screenLines[i];
      const partial = i === visibleLines ? Math.floor((typePhase % 1) * line.length) : line.length;
      ctx.fillText(line.slice(0, partial) + (i === visibleLines && partial < line.length ? "▌" : ""), sx + 10, sy + 18 + i * 16);
    }
    // Mini-Turbinen-Vorschau auf Screen
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 0.8;
    const miniCx = sx + sw * 0.72;
    const miniCy = sy + screenH * 0.65;
    const miniR = sw * 0.12;
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + (i / 5) * TAU;
      ctx.beginPath();
      ctx.moveTo(miniCx, miniCy);
      ctx.lineTo(miniCx + Math.cos(a) * miniR, miniCy + Math.sin(a) * miniR * 0.4);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      p.y -= p.sp;
      if (p.y < 0) p.y = 1;
      const px = (p.x + Math.sin(t + p.z * 10) * 0.02 + (mouseX - 0.5) * 0.05) * w;
      const py = (p.y + scrollP * 0.1) * h;
      const a = 0.15 + p.z * 0.35;
      ctx.fillStyle = `rgba(0,113,227,${a})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, TAU);
      ctx.fill();
    }
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const step = 48;
    const off = (t * 20) % step;
    for (let x = -off; x < w + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.35);
      ctx.lineTo(x + (mouseX - 0.5) * 30, h);
      ctx.stroke();
    }
    for (let y = h * 0.35; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function draw() {
    if (destroyed) return;
    raf = requestAnimationFrame(draw);
    if (paused || w < 2 || h < 2) return;

    t += 0.012;
    typePhase += 0.018;

    const scaleMul = compact ? 0.75 : strip ? 0.65 : 1;

    // Hintergrund
    const bg = ctx.createRadialGradient(w * 0.55, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    bg.addColorStop(0, strip ? "#0d1a2e" : "#0a1628");
    bg.addColorStop(0.45, "#050508");
    bg.addColorStop(1, "#000000");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (!strip) drawGrid();
    drawParticles();

    const mx = (mouseX - 0.5) * 0.35;
    const my = (mouseY - 0.5) * 0.2;

    // Haupt-Turbine (groß, rechts oben)
    drawWireObject(turbineLines, {
      scale: (0.55 - scrollP * 0.08) * scaleMul,
      ox: strip ? 0.5 + mx * 0.04 : 0.58 + mx * 0.05,
      oy: strip ? 0.45 + my * 0.03 : 0.38 + my * 0.04 + scrollP * 0.06,
      rotXa: 0.35 + Math.sin(t * 0.4) * 0.08,
      rotYa: t * 0.55 + mx,
      rotZa: Math.sin(t * 0.25) * 0.06,
      color: "rgba(0,180,255,ALPHA)",
      alpha: strip ? 0.65 : 0.85,
      lineW: 1.2,
    });

    // Zweite Turbine (kleiner, hinten)
    drawWireObject(turbineLines, {
      scale: 0.28 * scaleMul,
      ox: strip ? 0.72 + mx * 0.02 : 0.78 + mx * 0.03,
      oy: strip ? 0.38 + scrollP * 0.02 : 0.28 + scrollP * 0.04,
      rotXa: 0.5,
      rotYa: -t * 0.35,
      rotZa: 0.1,
      color: "rgba(100,140,255,ALPHA)",
      alpha: 0.35,
      lineW: 0.8,
    });

    // Zahnrad
    drawWireObject(gearLines, {
      scale: 0.32 * scaleMul,
      ox: strip ? 0.28 + mx * 0.03 : 0.42 + mx * 0.04,
      oy: strip ? 0.5 + my * 0.02 : 0.52 + my * 0.03,
      rotXa: 0.6,
      rotYa: t * 0.8,
      rotZa: 0,
      color: "rgba(245,99,0,ALPHA)",
      alpha: strip ? 0.4 : 0.5,
      lineW: 1,
    });

    if (!strip) {
      // CAD-Achsen-Kreuz
      const axisLen = Math.min(w, h) * 0.08;
      const ax = w * 0.35;
      const ay = h * 0.55;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255,59,48,0.5)";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + axisLen, ay); ctx.stroke();
      ctx.strokeStyle = "rgba(52,199,89,0.5)";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - axisLen); ctx.stroke();
      ctx.strokeStyle = "rgba(0,113,227,0.5)";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - axisLen * 0.6, ay + axisLen * 0.5); ctx.stroke();

      if (!compact) drawEngineerScene();
    }

    // Vignette
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, strip ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  function onMove(ev) {
    const r = canvas.getBoundingClientRect();
    if (r.width < 1) return;
    mouseX = (ev.clientX - r.left) / r.width;
    mouseY = (ev.clientY - r.top) / r.height;
  }

  function onScroll() {
    const hero = canvas.closest(".em-hero, .em-app-hero, .em-hero-strip");
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    scrollP = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.85)));
    if (!strip && !compact) {
      canvas.style.transform = `scale(${1 + scrollP * 0.04}) translateY(${scrollP * -20}px)`;
    }
  }

  function onVisibility() {
    paused = document.hidden;
    if (!paused) resize();
  }

  resize();
  const ro = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => resize())
    : null;
  ro?.observe(canvas);
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  onScroll();
  draw();

  const api = {
    refresh: resize,
    pause: () => { paused = true; },
    resume: () => { paused = false; resize(); },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
  return api;
}

export function initScrollReveal(root = document) {
  const els = root.querySelectorAll(".em-reveal");
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          const delay = Number(e.target.dataset.delay || 0);
          if (delay) e.target.style.transitionDelay = `${delay}ms`;
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

export function initParallaxCards(root = document) {
  const cards = [...root.querySelectorAll(".em-feature-card[data-parallax]")];
  if (!cards.length) return () => {};
  function onScroll() {
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      const shift = center * 0.04;
      card.style.transform = `translateY(${-shift}px)`;
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  return () => window.removeEventListener("scroll", onScroll);
}
