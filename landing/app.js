// Signs light as their cited sentence crosses the reading line, then rank
// themselves: lit signs move ahead of unlit ones, in tier-then-money order.
(function () {
  const list = document.querySelector(".signs");
  if (!list) return;
  const items = Array.from(list.children);
  const signFor = new Map();
  items.forEach((li) => {
    const btn = li.querySelector(".flag-sign");
    signFor.set(btn.dataset.target, { li, btn });
  });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = window.matchMedia("(max-width: 640px)");

  // On phones the signs scroll sideways, so bring the sign that just lit into view.
  function reveal(li) {
    if (!phone.matches) return;
    list.scrollTo({
      left: li.offsetLeft - list.firstElementChild.offsetLeft,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  function rerank() {
    const before = new Map(items.map((li) => [li, li.getBoundingClientRect()]));
    const ordered = items.slice().sort((a, b) => {
      const la = a.querySelector(".is-lit") ? 0 : 1;
      const lb = b.querySelector(".is-lit") ? 0 : 1;
      return la - lb || a.dataset.rank - b.dataset.rank;
    });
    ordered.forEach((li) => list.appendChild(li));
    if (reduced) return;
    ordered.forEach((li) => {
      const a = before.get(li);
      const b = li.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) return;
      li.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    });
  }

  function light(id, scroll = true) {
    const entry = signFor.get(id);
    const mark = document.getElementById(id);
    if (!entry || entry.btn.classList.contains("is-lit")) return;
    entry.btn.classList.add("is-lit");
    if (mark) mark.classList.add("is-lit");
    rerank();
    if (scroll) reveal(entry.li);
  }

  if (reduced || !("IntersectionObserver" in window)) {
    signFor.forEach((_, id) => light(id, false));
  } else {
    // Start in document order, so the ranking is visible as signs light.
    items
      .slice()
      .sort((a, b) => {
        const ma = document.getElementById(a.querySelector(".flag-sign").dataset.target);
        const mb = document.getElementById(b.querySelector(".flag-sign").dataset.target);
        return ma.compareDocumentPosition(mb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      })
      .forEach((li) => list.appendChild(li));

    // The first cited sentence is marked from the start.
    light(items[0].querySelector(".flag-sign").dataset.target);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            light(e.target.id);
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "-30% 0px -45% 0px" }
    );
    signFor.forEach((_, id) => {
      const mark = document.getElementById(id);
      if (mark) io.observe(mark);
    });
  }

  // Selecting a sign takes you to its sentence.
  let active = null;
  list.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".flag-sign");
    if (!btn) return;
    const id = btn.dataset.target;
    const mark = document.getElementById(id);
    if (!mark) return;
    light(id);
    if (active) {
      active.btn.classList.remove("is-active");
      active.mark.classList.remove("is-active");
    }
    btn.classList.add("is-active");
    mark.classList.add("is-active");
    active = { btn, mark };
    mark.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    mark.focus({ preventScroll: true });
  });
})();
