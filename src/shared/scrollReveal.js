// Scroll-triggered reveal animations — a small hand-written IntersectionObserver
// system, the same technique Apple's own site uses (their bundle ships a
// class called AnimSystemModel driving scroll-linked reveals/lazy-loads;
// this is the from-scratch equivalent, no framework, no library).
class ScrollAnimator {
  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            this.observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );
  }

  // Marks an element to fade/slide in once it scrolls into view.
  reveal(el, delay = 0) {
    el.classList.add("reveal");
    el.style.transitionDelay = `${delay}s`;
    this.observer.observe(el);
    return el;
  }
}

export const scrollAnimator = new ScrollAnimator();

// Wraps `children` in a div that fades/slides in on scroll — the direct
// equivalent of the old React <Reveal> wrapper, built as a plain function.
export function reveal(children, { delay = 0, style = {} } = {}) {
  const div = document.createElement("div");
  Object.assign(div.style, style);
  for (const child of [].concat(children)) {
    if (child) div.appendChild(child);
  }
  scrollAnimator.reveal(div, delay);
  return div;
}
