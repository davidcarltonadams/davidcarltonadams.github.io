// works-filter.js — filter, sort, search, and render the works catalogue

(function () {
  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    search: "",
    forces: new Set(),          // empty = show all
    yearMin: null,
    yearMax: null,
    hasMedia: false,
    highlightedOnly: false,
    sort: "year-desc",          // "year-desc" | "year-asc" | "title-asc"
    expanded: null              // id of expanded work, or null
  };

  // ── DOM refs ───────────────────────────────────────────────────────────────
  let listEl, countEl;

  // ── Boot ───────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    listEl  = document.getElementById("works-list");
    countEl = document.getElementById("works-count");

    buildFilters();
    bindSort();
    bindSearch();
    render();
  }

  // ── Build filter UI ────────────────────────────────────────────────────────
  function buildFilters() {
    // Force chips
    const chipsEl = document.getElementById("force-chips");
    FORCE_CATEGORIES.forEach(f => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.dataset.force = f;
      btn.textContent = FORCE_LABELS[f];
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        if (state.forces.has(f)) {
          state.forces.delete(f);
          btn.classList.remove("active");
          btn.setAttribute("aria-pressed", "false");
        } else {
          state.forces.add(f);
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
        }
        render();
      });
      chipsEl.appendChild(btn);
    });

    // Year range
    const years = WORKS.map(w => w.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    const yearFromEl = document.getElementById("year-from");
    const yearToEl   = document.getElementById("year-to");

    yearFromEl.placeholder = minYear;
    yearToEl.placeholder   = maxYear;
    yearFromEl.min = minYear; yearFromEl.max = maxYear;
    yearToEl.min   = minYear; yearToEl.max   = maxYear;

    yearFromEl.addEventListener("input", () => {
      state.yearMin = yearFromEl.value ? parseInt(yearFromEl.value) : null;
      render();
    });
    yearToEl.addEventListener("input", () => {
      state.yearMax = yearToEl.value ? parseInt(yearToEl.value) : null;
      render();
    });

    // Toggles
    document.getElementById("toggle-media").addEventListener("change", e => {
      state.hasMedia = e.target.checked;
      render();
    });
    document.getElementById("toggle-highlighted").addEventListener("change", e => {
      state.highlightedOnly = e.target.checked;
      render();
    });

    // Clear filters button
    document.getElementById("clear-filters").addEventListener("click", clearFilters);
  }

  function bindSort() {
    document.querySelectorAll("[data-sort]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-sort]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.sort = btn.dataset.sort;
        render();
      });
    });
  }

  function bindSearch() {
    const searchEl = document.getElementById("works-search");
    searchEl.addEventListener("input", () => {
      state.search = searchEl.value.trim().toLowerCase();
      render();
    });
  }

  // ── Filter + sort ──────────────────────────────────────────────────────────
  function filterWorks() {
    return WORKS.filter(w => {
      // Search
      if (state.search) {
        const hay = [w.title, w.instrumentation, w.notes,
                     w.premiere.performers, w.premiere.venue]
                      .join(" ").toLowerCase();
        if (!hay.includes(state.search)) return false;
      }
      // Forces (multi-select: work must have ALL selected forces)
      if (state.forces.size > 0) {
        for (const f of state.forces) {
          if (!w.forces.includes(f)) return false;
        }
      }
      // Year range
      if (state.yearMin !== null && w.year < state.yearMin) return false;
      if (state.yearMax !== null && w.year > state.yearMax) return false;
      // Has media
      if (state.hasMedia && !w.links.score && !w.links.audio && !w.links.video) return false;
      // Highlighted only
      if (state.highlightedOnly && !w.highlighted) return false;
      return true;
    });
  }

  function sortWorks(works) {
    return [...works].sort((a, b) => {
      if (state.sort === "year-asc")  return a.year - b.year;
      if (state.sort === "title-asc") return a.title.localeCompare(b.title);
      return b.year - a.year; // default: year-desc
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    const filtered = sortWorks(filterWorks());
    countEl.textContent = `${filtered.length} work${filtered.length !== 1 ? "s" : ""}`;

    // Show/hide clear button
    const hasFilters = state.forces.size > 0 || state.yearMin || state.yearMax
      || state.hasMedia || state.highlightedOnly || state.search;
    document.getElementById("clear-filters").style.display = hasFilters ? "inline-flex" : "none";

    listEl.innerHTML = "";
    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="works-empty">No works match the current filters.</p>';
      return;
    }

    filtered.forEach(w => {
      listEl.appendChild(buildWorkRow(w));
    });
  }

  // ── Build a single work row ────────────────────────────────────────────────
  function buildWorkRow(w) {
    const isExpanded = state.expanded === w.id;
    const hasAnyLink = w.links.score || w.links.audio || w.links.video;

    const row = document.createElement("article");
    row.className = "work-row" + (w.highlighted ? " work-highlighted" : "") + (isExpanded ? " expanded" : "");
    row.dataset.id = w.id;

    // ── Summary line (always visible) ────────────────────────────────────────
    const summary = document.createElement("div");
    summary.className = "work-summary";
    summary.setAttribute("role", "button");
    summary.setAttribute("tabindex", "0");
    summary.setAttribute("aria-expanded", isExpanded);
    summary.setAttribute("aria-label", `${w.title}, ${w.year}`);

    summary.innerHTML = `
      <div class="work-main">
        <span class="work-title">${escHtml(w.title)}</span>
        ${w.highlighted ? '<span class="work-star" title="Major work" aria-label="Featured work">★</span>' : ""}
        <span class="work-year">${w.year}</span>
      </div>
      <div class="work-meta">
        <span class="work-instr">${escHtml(w.instrumentation)}</span>
        <span class="work-dur">${escHtml(w.duration)}</span>
      </div>
      <div class="work-footer-row">
        <div class="work-tags">
          ${w.forces.map(f => `<span class="tag">${escHtml(FORCE_LABELS[f])}</span>`).join("")}
          ${hasAnyLink ? '<span class="tag tag-media">media</span>' : ""}
        </div>
        <span class="work-chevron" aria-hidden="true">${isExpanded ? "−" : "+"}</span>
      </div>
    `;

    summary.addEventListener("click",  () => toggleExpand(w.id));
    summary.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(w.id); } });

    row.appendChild(summary);

    // ── Detail panel ──────────────────────────────────────────────────────────
    const detail = document.createElement("div");
    detail.className = "work-detail";
    detail.hidden = !isExpanded;

    const premiereBlock = w.premiere.date ? `
      <div class="detail-block">
        <h4>Premiere</h4>
        <p>${escHtml(w.premiere.date_display)}</p>
        <p>${escHtml(w.premiere.performers)}</p>
        <p>${escHtml(w.premiere.venue)}</p>
      </div>
    ` : "";

    const linksBlock = hasAnyLink ? `
      <div class="detail-block">
        <h4>Links</h4>
        <div class="detail-links">
          ${w.links.score ? `<a href="${escHtml(w.links.score)}" target="_blank" rel="noopener" class="detail-link">Score</a>` : ""}
          ${w.links.audio ? `<a href="${escHtml(w.links.audio)}" target="_blank" rel="noopener" class="detail-link">Audio</a>` : ""}
          ${w.links.video ? `<a href="${escHtml(w.links.video)}" target="_blank" rel="noopener" class="detail-link">Video</a>` : ""}
        </div>
      </div>
    ` : "";

    const notesBlock = w.notes ? `
      <div class="detail-block">
        <h4>Notes</h4>
        <p>${escHtml(w.notes)}</p>
      </div>
    ` : "";

    detail.innerHTML = `
      <div class="detail-inner">
        ${premiereBlock}
        ${linksBlock}
        ${notesBlock}
      </div>
    `;

    row.appendChild(detail);
    return row;
  }

  // ── Expand / collapse ─────────────────────────────────────────────────────
  function toggleExpand(id) {
    state.expanded = state.expanded === id ? null : id;
    render();
    // Scroll expanded row into view gently
    if (state.expanded) {
      const el = listEl.querySelector(`[data-id="${state.expanded}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // ── Clear filters ─────────────────────────────────────────────────────────
  function clearFilters() {
    state.search = "";
    state.forces.clear();
    state.yearMin = null;
    state.yearMax = null;
    state.hasMedia = false;
    state.highlightedOnly = false;

    document.getElementById("works-search").value = "";
    document.getElementById("year-from").value = "";
    document.getElementById("year-to").value = "";
    document.getElementById("toggle-media").checked = false;
    document.getElementById("toggle-highlighted").checked = false;
    document.querySelectorAll(".chip.active").forEach(btn => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });

    render();
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return "";
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

})();
