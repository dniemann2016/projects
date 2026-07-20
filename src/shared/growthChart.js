import { h, svg } from "./dom.js";
import { T } from "./tokens.js";
import { futureValue } from "./format.js";

function onVisible(el, cb) {
  const obs = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        cb();
        obs.unobserve(el);
      }
    },
    { threshold: 0.15 }
  );
  obs.observe(el);
}

export function growthChart({ monthly, ret, years }) {
  const points = [];
  for (let y = 0; y <= years; y++) {
    points.push({ y, invested: monthly * 12 * y, value: futureValue(monthly, ret, y) });
  }
  const max = points[points.length - 1].value || 1;
  const W = 640, H = 260, P = 10;
  const toXY = (i, v) => [P + (i / years) * (W - 2 * P), H - P - (v / max) * (H - 2 * P)];
  const path = (key) =>
    points.map((p, i) => { const [x, y] = toXY(i, p[key]); return `${i === 0 ? "M" : "L"}${x},${y}`; }).join(" ");

  const gradientId = `gGreen-${Math.random().toString(36).slice(2, 9)}`;

  const areaPath = svg("path", {
    d: `${path("value")} L${W - P},${H - P} L${P},${H - P} Z`,
    fill: `url(#${gradientId})`,
    style: { opacity: "0", transition: "opacity 1.5s ease 0.8s" },
  });
  const investedPath = svg("path", {
    d: path("invested"), fill: "none", stroke: T.textFaint, "stroke-width": "2",
    style: { strokeDasharray: "1200", strokeDashoffset: "1200", transition: "all 2s ease" },
  });
  const valuePath = svg("path", {
    d: path("value"), fill: "none", stroke: T.green, "stroke-width": "3", "stroke-linecap": "round",
    pathLength: "100",
    style: { strokeDasharray: "100", strokeDashoffset: "100", transition: "stroke-dashoffset 2.2s cubic-bezier(0.6,0,0.2,1) 0.2s" },
  });

  const defs = svg("defs", {});
  const gradient = svg("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "0", y2: "1" });
  gradient.appendChild(svg("stop", { offset: "0%", "stop-color": T.green, "stop-opacity": "0.35" }));
  gradient.appendChild(svg("stop", { offset: "100%", "stop-color": T.green, "stop-opacity": "0" }));
  defs.appendChild(gradient);

  const svgEl = svg("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", height: "auto", display: "block" } });
  svgEl.append(defs, areaPath, investedPath, valuePath);

  const container = h(
    "div",
    { style: { width: "100%" } },
    svgEl,
    h(
      "div",
      { style: { display: "flex", gap: "24px", marginTop: "8px", fontSize: "13px", color: T.textDim } },
      h("span", {}, h("span", { style: { color: T.green } }, "—"), " Vermögen mit Zinseszins"),
      h("span", {}, h("span", { style: { color: T.textFaint } }, "- -"), " Nur eingezahlt")
    )
  );

  onVisible(container, () => {
    areaPath.style.opacity = "1";
    investedPath.style.strokeDasharray = "6 6";
    investedPath.style.strokeDashoffset = "0";
    valuePath.style.strokeDashoffset = "0";
  });

  return container;
}

export function compareChart({ series, years }) {
  const colors = [T.green, T.teal, T.purple, T.orange];
  const allPoints = series.map((s) => {
    const pts = [];
    for (let y = 0; y <= years; y++) pts.push({ y, value: futureValue(s.monthly, s.ret, y) });
    return pts;
  });
  const max = Math.max(1, ...allPoints.map((pts) => pts[pts.length - 1].value));
  const W = 640, H = 260, P = 10;
  const toXY = (i, v) => [P + (i / years) * (W - 2 * P), H - P - (v / max) * (H - 2 * P)];
  const pathFor = (pts) => pts.map((p, i) => { const [x, y] = toXY(i, p.value); return `${i === 0 ? "M" : "L"}${x},${y}`; }).join(" ");

  const svgEl = svg("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", height: "auto", display: "block" } });
  const paths = allPoints.map((pts, i) =>
    svg("path", {
      d: pathFor(pts), fill: "none", stroke: colors[i % colors.length], "stroke-width": "3", "stroke-linecap": "round",
      pathLength: "100",
      style: { strokeDasharray: "100", strokeDashoffset: "100", transition: `stroke-dashoffset 2s cubic-bezier(0.6,0,0.2,1) ${i * 0.15}s` },
    })
  );
  svgEl.append(...paths);

  const legend = h(
    "div",
    { style: { display: "flex", gap: "20px", marginTop: "8px", fontSize: "13px", color: T.textDim, flexWrap: "wrap" } },
    ...series.map((s, i) => h("span", {}, h("span", { style: { color: colors[i % colors.length] } }, "—"), ` ${s.name}`))
  );

  const container = h("div", { style: { width: "100%" } }, svgEl, legend);
  onVisible(container, () => paths.forEach((p) => { p.style.strokeDashoffset = "0"; }));
  return container;
}
