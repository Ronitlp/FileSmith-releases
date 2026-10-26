/* FileSmith site: no dependencies, no requests beyond this site's own files. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } },
  };

  /* ───────── release info: latest.json is the one source of truth ───────── */
  const FALLBACK = {
    version: "1.9.0",
    installer: {
      url: "https://github.com/Ronitlp/FileSmith-releases/releases/download/v1.9.0/FileSmith-Setup-1.9.0.exe",
      size: 122010028,
      sha256: "9248b2c87d19db0feaf6d5806fd0d1c2001275ac0e7af374cadb0f1b89307b05",
    },
  };
  const mb = (bytes) => `${Math.round(bytes / 1048576)} MB`;
  function applyRelease(r) {
    if (!r || !r.version || !r.installer) return;
    $$("[data-dl]").forEach((a) => { a.href = r.installer.url; a.setAttribute("download", ""); });
    $$("[data-v-text]").forEach((el) => {
      el.textContent = /^version/.test(el.textContent) ? `version ${r.version}` : `Version ${r.version}`;
    });
    $$("[data-size]").forEach((el) => { el.textContent = mb(r.installer.size); });
    if (r.installer.sha256) $("#sha") && ($("#sha").textContent = r.installer.sha256);
    if (Array.isArray(r.notes) && r.notes.length && $("#notes")) {
      $("#notes").replaceChildren(...r.notes.map((n) => Object.assign(document.createElement("li"), { textContent: n })));
    }
  }
  applyRelease(FALLBACK);
  fetch("latest.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then(applyRelease).catch(() => {});

  /* ───────── theme ───────── */
  const root = document.documentElement;
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : !matchMedia("(prefers-color-scheme: light)").matches);
  $("#themeBtn")?.addEventListener("click", (e) => {
    const next = isDark() ? "light" : "dark";
    const apply = () => { root.dataset.theme = next; store.set("fs-theme", next); };
    if (!document.startViewTransition || reduced) { apply(); return; }
    // wipe the new theme in as a circle growing out of the button
    const r = e.currentTarget.getBoundingClientRect();
    root.style.setProperty("--x", `${r.left + r.width / 2}px`);
    root.style.setProperty("--y", `${r.top + r.height / 2}px`);
    root.classList.add("theme-wipe");
    document.startViewTransition(apply).finished.finally(() => root.classList.remove("theme-wipe"));
  });

  /* ───────── scroll progress, sticker parallax ───────── */
  if (!reduced) {
    const bar = Object.assign(document.createElement("div"), { className: "progress" });
    bar.setAttribute("aria-hidden", "true");
    document.body.prepend(bar);
    const stickers = $$(".sticker");
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--p", max > 0 ? String(scrollY / max) : "0");
      stickers.forEach((s, i) => s.style.setProperty("--py", `${-scrollY * (0.06 + (i % 3) * 0.04)}px`));
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  /* ───────── nav ───────── */
  const nav = $("#nav"), menuBtn = $("#menuBtn");
  menuBtn?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  $$("#navlinks a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); menuBtn?.setAttribute("aria-expanded", "false"); }));
  document.addEventListener("click", (e) => { if (nav.classList.contains("open") && !nav.contains(e.target)) { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } });
  // the menu slides away while you scroll down, and comes back as soon as you scroll up
  let lastY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY, dy = y - lastY;
    if (Math.abs(dy) < 6) return;
    const hide = dy > 0 && y > 120 && !nav.classList.contains("open") && !nav.contains(document.activeElement);
    nav.classList.toggle("tucked", hide);
    lastY = y;
  }, { passive: true });

  /* ───────── reveal on scroll ───────── */
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ───────── cursor glow on cards, magnetic buttons, tilt ───────── */
  if (finePointer && !reduced) {
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest?.(".card.glow");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
    $$(".magnet").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      b.addEventListener("pointerleave", () => { b.style.transform = ""; });
    });
    $$(".tilt").forEach((el) => {
      el.style.transition = "transform .6s cubic-bezier(.2,.7,.1,1)";
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1200px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* hero window flattens as it scrolls into view */
  const heroWin = $("#heroWindow");
  if (heroWin && !reduced) {
    const onScroll = () => {
      const r = heroWin.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.15) / (innerHeight * 0.6)));
      heroWin.style.setProperty("--rx", `${(1 - t) * 10}deg`);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  const heroVideo = $("#heroVideo");
  if (heroVideo && reduced) { heroVideo.removeAttribute("autoplay"); heroVideo.pause(); }

  /* ───────── format ticker ───────── */
  const FORMATS = ["PNG", "JPG", "WEBP", "HEIC", "AVIF", "PDF", "DOCX", "OCR", "TIFF", "BMP", "ICO", "GIF", "MP4", "MOV", "MKV",
    "WEBM", "AVI", "MP3", "WAV", "M4A", "OGG", "FLAC", "OPUS", "PPTX", "ODP", "TXT", "MD", "HTML", "ZIP", "TAR"];
  const ticker = $("#ticker");
  if (ticker) {
    const items = [...FORMATS, ...FORMATS].map((f, i) => {
      const s = document.createElement("span");
      s.textContent = f;
      if (i % 7 === 3) s.className = "hl";
      if (i >= FORMATS.length) s.setAttribute("aria-hidden", "true");
      return s;
    });
    ticker.append(...items);
  }

  /* ───────── short looping segments of the recordings (how it works) ───────── */
  const segIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    const v = en.target;
    if (en.isIntersecting) {
      if (!v.src) { v.src = v.dataset.src; v.currentTime = +v.dataset.from || 0; }
      if (!reduced) v.play().catch(() => {});
    } else v.pause();
  }), { threshold: 0.35 });
  $$("video[data-src]").forEach((v) => {
    const from = +v.dataset.from || 0, to = +v.dataset.to || Infinity;
    v.addEventListener("loadedmetadata", () => { v.currentTime = from; });
    v.addEventListener("timeupdate", () => { if (v.currentTime >= to) v.currentTime = from; });
    segIO.observe(v);
  });

  /* ───────── recordings player ───────── */
  const FLOWS = {
    convert: "A photo of Lago di Braies is dragged out of File Explorer. Shift opens the wheel (in the Smoke look), and dropping it on WEBP saves Lago di Braies.webp right next to it.",
    removebg: "Resting on the centre flips the wheel to Tools. EDIT fans out its tools, and REMOVE BG makes Golden retriever No BG.png in a few seconds, offline.",
    pdf: "The travel guide goes to PAGES → ORGANIZE. The Organize window opens with every page, ready to drag into a new order, rotate or delete.",
    video: "Three clips are selected and dropped on JOIN CLIPS. The editor opens with all of them on one timeline, and Space plays them.",
  };
  const fv = $("#flowVideo"), tabs = $$("#flowTabs .tab"), cap = $("#flowCaption");
  if (fv && tabs.length) {
    let current = 0, visible = false;
    const select = (i, play) => {
      current = (i + tabs.length) % tabs.length;
      tabs.forEach((t, j) => {
        t.setAttribute("aria-selected", String(j === current));
        t.querySelector(".prog").style.transform = "scaleX(0)";
      });
      const name = tabs[current].dataset.flow;
      fv.poster = `media/flow-${name}.jpg`;
      fv.src = `media/flow-${name}.mp4`;
      cap.textContent = FLOWS[name];
      if (play && !reduced) fv.play().catch(() => {});
    };
    tabs.forEach((t, i) => t.addEventListener("click", () => select(i, true)));
    fv.addEventListener("timeupdate", () => {
      const bar = tabs[current].querySelector(".prog");
      if (fv.duration) bar.style.transform = `scaleX(${fv.currentTime / fv.duration})`;
    });
    fv.addEventListener("ended", () => select(current + 1, visible));
    if (reduced) fv.controls = true;
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !fv.src) select(0, true);
      else if (visible) { if (!reduced) fv.play().catch(() => {}); }
      else fv.pause();
    }, { threshold: 0.4 }).observe(fv);
    cap.textContent = FLOWS.convert;
  }

  /* ───────── PDF tools: one real window, the tool's colour, and what you get ───────── */
  const pdfImg = $("#pdfImg"), pdfStage = $("#pdfStage"), pdfLine = $("#pdfLine");
  const ogPages = $$("#ogStrip .og-page");
  let ogTimer = null, ogOrder = [0, 1, 2, 3, 4, 5, 6, 7];
  const ogPlace = () => {
    // each page slides to its slot in the current order (4 columns, gaps included)
    const first = ogPages[0];
    if (!first) return;
    const w = first.offsetWidth + 12, h = first.offsetHeight + 12;
    ogOrder.forEach((p, slot) => {
      const dx = (slot % 4 - p % 4) * w, dy = (Math.floor(slot / 4) - Math.floor(p / 4)) * h;
      ogPages[p].style.transform = `translate(${dx}px, ${dy}px)`;
    });
  };
  const ogStep = () => {
    // pick up one page and drop it somewhere else, like dragging it in the Organize window
    const from = Math.floor(Math.random() * 8);
    let to = Math.floor(Math.random() * 8);
    if (to === from) to = (to + 3) % 8;
    const [p] = ogOrder.splice(from, 1);
    ogOrder.splice(to, 0, p);
    ogPages.forEach((el) => el.classList.toggle("moving", +el.dataset.p === p));
    ogPlace();
  };
  $$("#pdfTabs .pdf-tab").forEach((b, _, all) => b.addEventListener("click", () => {
    all.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    pdfStage.style.setProperty("--c", b.style.getPropertyValue("--c"));
    pdfLine.textContent = b.dataset.line;
    $$(".pdf-panel", pdfStage).forEach((p) => { p.hidden = p.dataset.for !== b.dataset.tool; });
    clearInterval(ogTimer);
    if (b.dataset.tool === "organize") {
      ogOrder = [0, 1, 2, 3, 4, 5, 6, 7];
      ogPlace();
      if (!reduced) ogTimer = setInterval(ogStep, 1800);
    }
    pdfImg.classList.add("swap");
    const next = new Image();
    next.onload = () => {
      pdfImg.src = next.src;
      pdfImg.width = +b.dataset.w;
      pdfImg.height = +b.dataset.h;
      pdfImg.alt = b.dataset.alt;
      requestAnimationFrame(() => pdfImg.classList.remove("swap"));
    };
    next.src = b.dataset.img;
  }));

  /* ───────── before / after sliders ───────── */
  $$(".compare").forEach((cmp) => {
    const set = (p) => {
      p = Math.max(0, Math.min(100, p));
      cmp.style.setProperty("--pos", `${p}%`);
      cmp.setAttribute("aria-valuenow", String(Math.round(p)));
    };
    const fromEvent = (e) => { const r = cmp.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
    let dragging = false;
    cmp.addEventListener("pointerdown", (e) => { dragging = true; cmp.setPointerCapture(e.pointerId); fromEvent(e); });
    cmp.addEventListener("pointermove", (e) => { if (dragging) fromEvent(e); });   // moves only while dragged
    cmp.addEventListener("pointerup", () => { dragging = false; });
    cmp.addEventListener("pointercancel", () => { dragging = false; });
    cmp.addEventListener("keydown", (e) => {
      const now = +cmp.getAttribute("aria-valuenow");
      if (e.key === "ArrowLeft") { set(now - 5); e.preventDefault(); }
      if (e.key === "ArrowRight") { set(now + 5); e.preventDefault(); }
    });
  });
  $$(".compare-tabs button").forEach((b, _, all) => b.addEventListener("click", () => {
    all.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const isDog = /dog/.test(b.dataset.before);
    $("#cmpBefore").src = b.dataset.before;
    $("#cmpAfter").src = b.dataset.after;
    $("#cmpBefore").alt = isDog ? "Before: a golden retriever photographed outdoors in front of trees" : "Before: black headphones on a white table";
    $("#cmpAfter").alt = isDog ? "After: the golden retriever cut out on a transparent background" : "After: the headphones cut out on a transparent background, the table and its shadow gone";
    $("#compare").style.setProperty("--pos", "50%");
  }));

  /* ───────── count up ───────── */
  const countIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    countIO.unobserve(en.target);
    const el = en.target, to = +el.dataset.count;
    if (!to || reduced) { el.textContent = String(to); return; }
    const t0 = performance.now(), dur = 1200;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ───────── copy SHA-256 ───────── */
  $("#copySha")?.addEventListener("click", async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText($("#sha").textContent.trim()); b.textContent = "Copied"; }
    catch (err) { getSelection().selectAllChildren($("#sha")); b.textContent = "Press Ctrl+C"; }
    setTimeout(() => { b.textContent = "Copy"; }, 1800);
  });

  /* ───────── looks ───────── */
  const LOOKS = ["glass", "frost", "smoke", "aqua", "rose", "light", "dark", "original", "midnight", "sunset", "ocean", "forest", "candy", "neon", "mocha", "lavender"];
  const GLASSY = new Set(["glass", "frost", "smoke", "aqua", "rose"]);
  const looks = $("#lookGrid");
  if (looks) {
    const cards = LOOKS.map((k, i) => {
      const a = document.createElement("figure");
      a.className = `card look reveal${GLASSY.has(k) ? " on-glass" : ""}${i % 4 ? ` d${i % 4}` : ""}`;
      a.style.margin = "0";
      const name = k[0].toUpperCase() + k.slice(1);
      a.innerHTML = `<img src="img/theme-${k}.webp" width="556" height="556" loading="lazy" alt="The wheel in the ${name} look${GLASSY.has(k) ? ", real frosted glass over the wallpaper behind it" : ""}"><figcaption><b>${name}</b></figcaption>`;
      return a;
    });
    const custom = document.createElement("figure");
    custom.className = "card look reveal d3";
    custom.style.margin = "0";
    custom.innerHTML = `<div style="aspect-ratio:1;display:grid;place-items:center"><div style="width:72%;aspect-ratio:1;border-radius:50%;border:3px solid #111;background:conic-gradient(#ff5ca8,#ffd23f,#c6f432,#4ee2b0,#5b8cff,#b69cff,#ff5ca8);display:grid;place-items:center"><div style="width:44%;aspect-ratio:1;border-radius:50%;border:3px solid #111;background:var(--card)"></div></div></div><figcaption><b>Your own</b></figcaption>`;
    looks.append(...cards, custom);
    $$(".reveal", looks).forEach((el) => io.observe(el));
  }

  /* ───────── format finder ───────── */
  const ROWS = [
    { name: "Images", sub: "PNG, JPG, WEBP, HEIC, AVIF, BMP, TIFF, GIF, ICO", from: ["png", "jpg", "webp", "heic", "avif", "bmp", "tiff", "gif", "ico", "image"],
      to: ["PNG", "JPG", "WEBP", "HEIC", "AVIF", "PDF", "TIFF", "BMP", "ICO"], tools: ["Crop", "Resize", "Remove BG", "Add BG", "Rotate", "Compress", "Strip info", "Merge to PDF", "Zip"] },
    { name: "PDF", sub: "Locked PDFs too", from: ["pdf"], to: ["DOCX", "DOCX + OCR", "JPG", "PNG", "TXT", "WEBP", "TIFF"],
      tools: ["Split", "Organize", "Merge", "Rotate", "Page numbers", "Watermark", "Add password", "Remove password", "Compress", "Zip"] },
    { name: "Video", sub: "MP4, MOV, MKV, WEBM, AVI…", from: ["mp4", "mov", "mkv", "webm", "avi", "video"], to: ["MP4", "WEBM", "MOV", "MKV", "GIF", "MP3", "WAV"],
      tools: ["Edit video", "Join clips", "Compress", "Half size", "Mute", "Zip"] },
    { name: "Audio", sub: "MP3, WAV, M4A, OGG, FLAC, OPUS…", from: ["mp3", "wav", "m4a", "ogg", "flac", "opus", "audio"], to: ["MP3", "WAV", "M4A", "OGG", "FLAC", "OPUS"],
      tools: ["Compress", "Normalize", "Zip"] },
    { name: "Word documents", sub: "DOCX", from: ["docx"], to: ["PDF", "TXT", "HTML", "MD"], tools: ["Zip"] },
    { name: "Slides", sub: "PPTX, PPT, ODP", from: ["pptx", "ppt", "odp"], to: ["PDF", "JPG", "PNG"], tools: ["Zip"] },
    { name: "Text & Markdown", sub: "TXT, MD", from: ["txt", "md"], to: ["PDF", "DOCX", "HTML", "TXT", "MD"], tools: ["Zip"] },
    { name: "Archives", sub: "ZIP, TAR, TAR.GZ…", from: ["zip", "tar", "gz"], to: [], tools: ["Extract"] },
    { name: "Folders & anything else", sub: "", from: ["folder"], to: [], tools: ["Zip"] },
  ];
  const ALIAS = { jpeg: "jpg", tif: "tiff", word: "docx", doc: "docx", text: "txt", markdown: "md", powerpoint: "pptx", heif: "heic",
    photo: "image", photos: "image", picture: "image", pictures: "image", images: "image", png: "png", movie: "video", videos: "video",
    music: "audio", sound: "audio", ocr: "docx + ocr", mpeg4: "mp4", m4v: "mp4", tgz: "gz", "tar.gz": "gz", directory: "folder" };
  const norm = (w) => { w = w.trim().toLowerCase().replace(/^\./, ""); return ALIAS[w] || w; };
  const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const matrix = $("#matrix"), answer = $("#answer"), finder = $("#finder");
  if (matrix) {
    const rowEls = ROWS.map((r) => {
      const d = document.createElement("div");
      d.className = "card mrow";
      d.innerHTML = `<h4>${r.name}${r.sub ? `<small>${r.sub}</small>` : ""}</h4>
        <div><div class="k">Convert to</div><div class="chips">${r.to.length ? r.to.map((x) => `<span>${x}</span>`).join("") : '<span class="muted" style="background:none;border:0;padding:4px 0">—</span>'}</div></div>
        <div><div class="k">Tools</div><div class="chips">${r.tools.map((x) => `<span>${x}</span>`).join("")}</div></div>`;
      matrix.append(d);
      return d;
    });
    const reset = () => rowEls.forEach((d) => { d.classList.remove("dim", "hit"); $$(".chips span", d).forEach((s) => s.classList.remove("hit")); });
    const say = (html) => { answer.innerHTML = html; };
    const query = () => {
      reset();
      const q = finder.value.trim().toLowerCase();
      if (!q) { say(""); return; }
      const m = q.match(/^(.+?)\s*(?:to|->|→|into|2)\s*(.+)$/);
      if (m) {
        const a = norm(m[1]), b = norm(m[2]);
        const row = ROWS.findIndex((r) => r.from.includes(a));
        if (row < 0) { say(`<span class="no">Not that one.</span> FileSmith doesn't open <b>${esc(m[1].toUpperCase())}</b> files.`); return; }
        rowEls.forEach((d, i) => d.classList.toggle("dim", i !== row));
        rowEls[row].classList.add("hit");
        if (a === b) { say(`That's the same format already. Try a different target.`); return; }
        const targets = ROWS[row].to.map((x) => x.toLowerCase()), tools = ROWS[row].tools.map((x) => x.toLowerCase());
        const ti = targets.indexOf(b === "docx + ocr" ? "docx + ocr" : b), oi = tools.indexOf(b);
        if (ti >= 0) {
          $$(".chips", rowEls[row])[0].children[ti].classList.add("hit");
          say(`<span class="yes">Yes.</span> Drag a <b>${a.toUpperCase()}</b>, tap Shift, drop it on <b>${ROWS[row].to[ti]}</b>.`);
        } else if (oi >= 0) {
          $$(".chips", rowEls[row])[1].children[oi].classList.add("hit");
          say(`<span class="yes">Yes.</span> It's on the Tools page: <b>${ROWS[row].tools[oi]}</b>.`);
        } else say(`<span class="no">Not directly.</span> ${ROWS[row].name} can become: ${ROWS[row].to.join(", ") || "nothing (but see Tools)"}.`);
        return;
      }
      const w = norm(q);
      let any = false;
      rowEls.forEach((d, i) => {
        const r = ROWS[i];
        let hit = r.from.includes(w) || r.name.toLowerCase().includes(w);
        $$(".chips span", d).forEach((s) => { if (s.textContent.toLowerCase() === w || (w.length > 2 && s.textContent.toLowerCase().includes(w))) { s.classList.add("hit"); hit = true; } });
        d.classList.toggle("dim", !hit);
        any = any || hit;
      });
      say(any ? `Highlighted everywhere <b>${esc(q.toUpperCase())}</b> shows up.` : `<span class="no">Nothing for “${esc(q)}”.</span> Try a format like HEIC, MP4 or PDF.`);
    };
    finder.addEventListener("input", query);
  }
})();
