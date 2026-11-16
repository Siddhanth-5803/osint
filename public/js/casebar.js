// The yellow case bar: slides away while you read, comes back from a small tab.
// Tap or swipe down on the tab to show it; tap "hide", swipe up, or keep scrolling to hide it.
export function initCaseBar() {
  const report = document.getElementById("report");
  const bar = document.getElementById("case-bar");
  const pill = document.getElementById("case-pill");
  const pillTitle = document.getElementById("case-pill-title");
  const main = report?.querySelector("main");
  if (!bar || !pill || !main) return { reset() {}, setTitle() {} };

  let collapsed = false;
  let anchorY = 0;

  const measure = () => {
    if (report.hidden) return;
    const h = bar.offsetHeight;
    if (h) main.style.setProperty("--case-bar-h", `${h + 8}px`);
  };
  const set = (c) => {
    collapsed = c;
    bar.classList.toggle("collapsed", c);
    pill.classList.toggle("show", c);
    bar.inert = c;
    pill.setAttribute("aria-expanded", String(!c));
    anchorY = window.scrollY;
  };
  const onSwipe = (el, fn) => {
    let y0 = null;
    el.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      y0 = null;
      fn(dy);
    }, { passive: true });
  };

  pill.addEventListener("click", () => set(false));
  document.getElementById("case-collapse")?.addEventListener("click", () => set(true));
  onSwipe(pill, (dy) => { if (dy > 20) set(false); });
  onSwipe(bar, (dy) => { if (dy < -20) set(true); });
  // Picking a section from the bar: hide the bar so the section gets the whole screen.
  document.getElementById("jump")?.addEventListener("click", (e) => { if (e.target.closest("a")) setTimeout(() => set(true), 60); });
  // Reading: scrolling down past the top tucks the bar away. Scrolling up never forces it back.
  window.addEventListener("scroll", () => {
    if (report.hidden || collapsed) return;
    if (window.scrollY > 80 && window.scrollY - anchorY > 60) set(true);
  }, { passive: true });
  window.addEventListener("resize", measure);

  return {
    reset() { set(false); requestAnimationFrame(measure); },
    setTitle(t) { pillTitle.textContent = t; requestAnimationFrame(measure); },
  };
}
