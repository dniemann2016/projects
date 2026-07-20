/** Interaktive Netzwerkkarte — Personen, Teams, Projekte. */

import { h } from "../shared/dom.js";

const COLORS = {
  person: "#0071e3",
  team: "#64d2ff",
  project: "#bf5af2",
  edge: "rgba(255,255,255,0.12)",
};

export function mountNetworkMap(container, graph, { onNodeClick } = {}) {
  const wrap = h("div", { class: "em-network-wrap" });
  const canvas = h("canvas", { class: "em-network-canvas" });
  const tooltip = h("div", { class: "em-network-tip", style: { display: "none" } });
  const legend = h("div", { class: "em-network-legend" },
    h("span", {}, h("i", { class: "em-dot em-dot-green" }), " Fachmensch"),
    h("span", {}, h("i", { class: "em-dot em-dot-blue" }), " Team"),
    h("span", {}, h("i", { class: "em-dot em-dot-purple" }), " Projekt")
  );
  wrap.append(canvas, tooltip, legend);
  container.replaceChildren(wrap);

  const ctx = canvas.getContext("2d");
  let w = 0, hPx = 0, dpr = 1;
  let nodes = [];
  let edges = [];
  let hover = null;
  let drag = null;
  let t = 0;
  let raf = 0;
  let panX = 0, panY = 0, zoom = 1;

  function layout() {
    nodes = (graph.nodes || []).map((n, i) => {
      const angle = (i / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      const r = 0.32 + (i % 3) * 0.06;
      return {
        ...n,
        x: n.x != null ? n.x : 0.5 + Math.cos(angle) * r,
        y: n.y != null ? n.y : 0.5 + Math.sin(angle) * r,
        vx: 0, vy: 0,
        r: n.type === "team" ? 28 : n.type === "project" ? 22 : 20,
      };
    });
    edges = graph.edges || [];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = wrap.clientWidth;
    hPx = Math.max(420, Math.min(560, window.innerHeight * 0.55));
    canvas.width = w * dpr;
    canvas.height = hPx * dpr;
    canvas.style.height = `${hPx}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function toScreen(nx, ny) {
    const cx = w / 2 + panX;
    const cy = hPx / 2 + panY;
    const scale = Math.min(w, hPx) * zoom;
    return [cx + (nx - 0.5) * scale, cy + (ny - 0.5) * scale];
  }

  function hitTest(mx, my) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const [sx, sy] = toScreen(n.x, n.y);
      const dist = Math.hypot(mx - sx, my - sy);
      if (dist < n.r + 6) return n;
    }
    return null;
  }

  function simulate() {
    for (const n of nodes) {
      n.vx += (0.5 - n.x) * 0.002;
      n.vy += (0.5 - n.y) * 0.002;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(0.08, Math.hypot(dx, dy));
        const f = 0.0008 / (d * d);
        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f;
        b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.from);
      const b = nodes.find((n) => n.id === e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const target = 0.22;
      const f = (d - target) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(0.08, Math.min(0.92, n.x));
      n.y = Math.max(0.08, Math.min(0.92, n.y));
    }
  }

  function draw() {
    t += 0.016;
    simulate();
    ctx.fillStyle = "#1d1d1f";
    ctx.fillRect(0, 0, w, hPx);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hPx); ctx.stroke();
    }
    for (let y = 0; y < hPx; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.from);
      const b = nodes.find((n) => n.id === e.to);
      if (!a || !b) continue;
      const [ax, ay] = toScreen(a.x, a.y);
      const [bx, by] = toScreen(b.x, b.y);
      ctx.strokeStyle = COLORS.edge;
      ctx.lineWidth = e.type === "membership" ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    for (const n of nodes) {
      const [sx, sy] = toScreen(n.x, n.y);
      const pulse = 1 + Math.sin(t * 2 + n.x * 10) * 0.04;
      const r = n.r * pulse * (hover === n ? 1.15 : 1);
      const col = n.type === "team" ? COLORS.team : n.type === "project" ? COLORS.project : COLORS.person;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
      g.addColorStop(0, col + "88");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = `600 ${Math.max(9, r * 0.45)}px -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = n.label.length > 14 ? n.label.slice(0, 12) + "…" : n.label;
      ctx.fillText(label, sx, sy);
    }
    raf = requestAnimationFrame(draw);
  }

  function onMove(ev) {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    if (drag) {
      panX += ev.clientX - drag.x;
      panY += ev.clientY - drag.y;
      drag.x = ev.clientX; drag.y = ev.clientY;
      return;
    }
    const hit = hitTest(mx, my);
    hover = hit;
    canvas.style.cursor = hit ? "pointer" : "grab";
    if (hit) {
      tooltip.style.display = "block";
      tooltip.textContent = hit.label;
      tooltip.style.left = `${mx + 12}px`;
      tooltip.style.top = `${my - 8}px`;
    } else tooltip.style.display = "none";
  }

  canvas.addEventListener("mousedown", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
    if (hit) onNodeClick?.(hit);
    else drag = { x: ev.clientX, y: ev.clientY };
  });
  window.addEventListener("mouseup", () => { drag = null; });
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    zoom = Math.max(0.6, Math.min(1.6, zoom - ev.deltaY * 0.001));
  }, { passive: false });

  layout();
  resize();
  window.addEventListener("resize", resize);
  draw();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("mousemove", onMove);
  };
}
