import { h } from "./dom.js";

// Counts up from 0 to `value` once the element scrolls into view.
export function animatedNumber(value, format = (v) => Math.round(v), duration = 1400) {
  const span = h("span", {}, "0");
  const obs = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      obs.unobserve(span);
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        span.textContent = format(value * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { threshold: 0.15 }
  );
  obs.observe(span);
  return span;
}
