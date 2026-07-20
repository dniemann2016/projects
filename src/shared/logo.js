import { h } from "./dom.js";

// Uses Clearbit's public logo API (no key required) when a domain is known;
// falls back to a colored letter avatar for unknown companies or load failures.
export function logo({ domain, letter, color, size = 48 }) {
  const box = h("div", {
    style: {
      width: `${size}px`, height: `${size}px`, borderRadius: `${size * 0.29}px`,
      background: `${color}22`, color, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: `${size * 0.42}px`, fontWeight: "700", flexShrink: "0", overflow: "hidden",
    },
  });

  if (domain) {
    const img = h("img", {
      src: `https://logo.clearbit.com/${domain}?size=128`,
      alt: "", width: String(size), height: String(size),
      style: { objectFit: "contain", width: "100%", height: "100%" },
    });
    img.addEventListener("error", () => {
      img.remove();
      box.textContent = letter;
    });
    box.appendChild(img);
  } else {
    box.textContent = letter;
  }
  return box;
}
