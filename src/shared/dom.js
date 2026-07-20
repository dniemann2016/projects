// Minimal DOM-building helper — not a framework, just document.createElement
// with less ceremony. No virtual DOM, no diffing: callers rebuild whatever
// subtree changed and swap it in directly, the same way hand-written
// vanilla-JS UIs (this one included) normally work.
// CSS properties that stay unitless when given a bare number — everything
// else gets "px" appended, matching how React's inline-style prop behaves
// (raw el.style assignment does NOT do this on its own).
const UNITLESS = new Set([
  "opacity", "zIndex", "fontWeight", "lineHeight", "flex", "flexGrow", "flexShrink",
  "order", "zoom", "gridRow", "gridColumn", "tabSize", "columns", "columnCount",
]);

function applyStyle(el, style) {
  for (const [prop, value] of Object.entries(style)) {
    if (value == null) continue;
    el.style[prop] = typeof value === "number" && !UNITLESS.has(prop) ? `${value}px` : value;
  }
}

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "style" && typeof value === "object") {
      applyStyle(el, value);
    } else if (key === "class" || key === "className") {
      el.className = value;
    } else if (key === "html") {
      el.innerHTML = value;
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "ref" && typeof value === "function") {
      value(el);
    } else if (typeof value === "boolean") {
      if (value) el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Empties a container and fills it with newChildren — the "full re-render"
// primitive every page module uses instead of framework-managed diffing.
export function mount(container, ...newChildren) {
  container.replaceChildren();
  appendChildren(container, newChildren);
  return container;
}

export function svg(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else el.setAttribute(key, value);
  }
  return el;
}
