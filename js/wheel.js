/* The FileSmith wheel, in the browser: a port of filesmith/wheel.py's geometry, colours, glass and
   animation (same sizes, easings and timings at the app's default "Snappy" speed), drawn on a canvas.
   Exposes nothing; it wires itself to #pgStage / #wheelCanvas / #kinds / #looksPick. */
(() => {
  "use strict";
  const stage = document.getElementById("pgStage");
  const canvas = document.getElementById("wheelCanvas");
  if (!stage || !canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } },
  };

  /* ───────── geometry (wheel.py) ───────── */
  const R_DISC = 182, R_OUT = 166, R_IN = 80, HUB = 58, GAP = 7, CORNER = 12;
  const TILE_H = 34, TILE_PAD = 17, TILE_GAP = 8, FAN_CLEAR = 10, FAN_GRACE = 0.3;
  const PILL_Y = R_DISC + 40, SPAN = 640;            // the stage shows 640 wheel units edge to edge
  const TEMPO = 1.35;                                // the app's default animation speed ("Snappy")
  const FAMILY = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const F_LABEL = `650 13px ${FAMILY}`, F_HUB = `700 12.5px ${FAMILY}`, F_PCT = `700 19px ${FAMILY}`;
  const F_PILL = `600 13px ${FAMILY}`, F_PILL_SUB = `500 12px ${FAMILY}`;

  const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => { t = clamp(t); return 1 - (1 - t) ** 3; };
  const easeInCubic = (t) => { t = clamp(t); return t * t * t; };
  const easeOutBack = (t, s = 1.7) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
  const approach = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
  const pt = (r, a) => ({ x: Math.sin(a) * r, y: -Math.cos(a) * r });

  /* ───────── colours (themes.py) ───────── */
  const hex = (h, a = 255) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a });
  const C = (r, g, b, a = 255) => ({ r, g, b, a });
  const A = (c, a) => ({ ...c, a: Math.max(0, Math.min(255, Math.round(a))) });
  const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const shade = (c, amt) => {
    const t = Math.abs(amt), to = amt > 0 ? 255 : 0;
    return C(Math.round(c.r + (to - c.r) * t), Math.round(c.g + (to - c.g) * t), Math.round(c.b + (to - c.b) * t), c.a);
  };
  const mix = (c1, c2, t) => {
    t = clamp(t);
    return C(Math.round(lerp(c1.r, c2.r, t)), Math.round(lerp(c1.g, c2.g, t)), Math.round(lerp(c1.b, c2.b, t)), Math.round(lerp(c1.a, c2.a, t)));
  };
  const css = (c, k = 1) => `rgba(${c.r},${c.g},${c.b},${((c.a / 255) * k).toFixed(4)})`;
  const W_ = C(255, 255, 255), B_ = C(0, 0, 0);

  const PRESETS = {
    smoke:    { n: "Smoke", ring: "#0E0E12", segments: "#15151B", highlight: "#FFFFFF", text: "#F4F4F8", hl_text: "#111116", glass: 1, frost: 0.3 },
    glass:    { n: "Glass", ring: "#FFFFFF", segments: "#FFFFFF", highlight: "#FFFFFF", text: "#16161A", hl_text: "#0E0E12", glass: 1, frost: 0 },
    frost:    { n: "Frost", ring: "#FFFFFF", segments: "#FFFFFF", highlight: "#FFFFFF", text: "#1C1C22", hl_text: "#111116", glass: 1, frost: 1 },
    aqua:     { n: "Aqua", ring: "#E6FBFF", segments: "#8FE6FF", highlight: "#16B8F3", text: "#06323F", hl_text: "#FFFFFF", glass: 1, frost: 0.2 },
    rose:     { n: "Rose", ring: "#FFF0F6", segments: "#FFB5D2", highlight: "#FF4F8F", text: "#4A0F28", hl_text: "#FFFFFF", glass: 1, frost: 0.2 },
    light:    { n: "Light", ring: "#ECECF0", segments: "#FAFAFC", highlight: "#24242A", text: "#2C2C30", hl_text: "#FFFFFF" },
    dark:     { n: "Dark", ring: "#222228", segments: "#36363C", highlight: "#F0F0F5", text: "#E6E6EC", hl_text: "#141418" },
    original: { n: "Original", ring: "#FFE2CC", segments: "#FDDFC5", highlight: "#FA6A2A", text: "#703C1C", hl_text: "#FFFFFF" },
    midnight: { n: "Midnight", ring: "#121628", segments: "#202846", highlight: "#5A8CFF", text: "#DCE4FF", hl_text: "#FFFFFF" },
    sunset:   { n: "Sunset", ring: "#FFD6AA", segments: "#FFF0E1", highlight: "#F05A28", text: "#6E3214", hl_text: "#FFFFFF" },
    ocean:    { n: "Ocean", ring: "#C8E8F5", segments: "#F0FAFF", highlight: "#008CB4", text: "#14465A", hl_text: "#FFFFFF" },
    forest:   { n: "Forest", ring: "#1E3026", segments: "#2E4638", highlight: "#78D28C", text: "#DCF0E1", hl_text: "#102818" },
    candy:    { n: "Candy", ring: "#FFCDE6", segments: "#FFF0F8", highlight: "#EC4899", text: "#781E50", hl_text: "#FFFFFF" },
    neon:     { n: "Neon", ring: "#0C0C10", segments: "#1A1A22", highlight: "#00FFAA", text: "#C8FFEB", hl_text: "#001E14" },
    mocha:    { n: "Mocha", ring: "#5A4032", segments: "#785A48", highlight: "#F0C896", text: "#FAEBDC", hl_text: "#3C281C" },
    lavender: { n: "Lavender", ring: "#E1D7FA", segments: "#F5F0FF", highlight: "#825AE6", text: "#3C286E", hl_text: "#FFFFFF" },
  };

  function build(p) {
    const ring = hex(p.ring), seg = hex(p.segments), hl = hex(p.highlight), text = hex(p.text), hlText = hex(p.hl_text);
    const ringDark = lum(ring) < 0.45, segDark = lum(seg) < 0.45, hlDark = lum(hl) < 0.25;
    if (p.glass) {
      const frost = p.frost, darkTint = segDark;
      const top = 70 + 95 * frost + (darkTint ? 55 : 0), bot = 28 + 95 * frost + (darkTint ? 55 : 0);
      const whiteHl = lum(hl) > 0.85, pill = darkTint ? C(30, 30, 36) : W_;
      return {
        ink: text, hotInk: hlText, segTop: A(seg, top), segBot: A(seg, bot),
        hotA: A(shade(hl, 0.15), 228), hotB: A(hl, 180), hubFg: hlText,
        glow: whiteHl ? W_ : hl, glowK: whiteHl ? 4 : 3,
        discA: A(ring, 46 + 70 * frost + (ringDark ? 60 : 0)), discB: A(ring, 18 + 70 * frost + (ringDark ? 60 : 0)),
        sheen: A(W_, 60), well: A(B_, 18), wellRim: A(W_, 150), hubPillBg: A(pill, 205), hubPillInk: text,
        pillBg: A(pill, 232), pillBorder: A(W_, darkTint ? 70 : 255), pillTitle: text, pillSub: A(text, 165),
        shadow: 38, glass: true, frost,
      };
    }
    return {
      ink: text, hotInk: hlText,
      segTop: shade(seg, segDark ? 0.06 : 0.5), segBot: shade(seg, segDark ? -0.08 : -0.03),
      hotA: shade(hl, 0.16), hotB: shade(hl, -0.12), hubFg: hlText,
      glow: hlDark && !segDark ? B_ : hl, glowK: hlDark && !segDark ? 1 : 2.4,
      discA: A(shade(ring, ringDark ? 0.1 : 0.4), ringDark ? 230 : 215), discB: A(shade(ring, ringDark ? -0.12 : -0.04), ringDark ? 225 : 205),
      sheen: A(W_, ringDark ? 26 : 120), well: A(B_, ringDark ? 70 : 22), wellRim: A(W_, ringDark ? 30 : 170),
      hubPillBg: A(segDark ? shade(seg, -0.25) : shade(seg, 0.6), 242), hubPillInk: text,
      pillBg: A(segDark ? shade(seg, -0.1) : shade(seg, 0.6), 245), pillBorder: A(W_, segDark ? 30 : 255),
      pillTitle: text, pillSub: A(text, 165), shadow: ringDark ? 90 : 46, glass: false, frost: 0,
    };
  }

  /* ───────── shapes ───────── */
  // A polygon grown by r with round corners (convex turns) and plain joins (concave ones):
  // the same shape the app gets from "shrink by CORNER, stroke back out with round joins".
  function grow(pts, r) {
    const path = new Path2D(), n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p = pts[i], p1 = pts[(i + 1) % n];
      const e1x = p.x - p0.x, e1y = p.y - p0.y, e2x = p1.x - p.x, e2y = p1.y - p.y;
      const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
      const n1x = e1y / l1, n1y = -e1x / l1, n2x = e2y / l2, n2y = -e2x / l2;
      const ax = p.x + n1x * r, ay = p.y + n1y * r;
      if (i === 0) path.moveTo(ax, ay); else path.lineTo(ax, ay);
      if (e1x * e2y - e1y * e2x > 0 && r > 0) path.arc(p.x, p.y, r, Math.atan2(n1y, n1x), Math.atan2(n2y, n2x), false);
      else path.lineTo(p.x + n2x * r, p.y + n2y * r);
    }
    path.closePath();
    return path;
  }
  const GEO = {};
  function segmentGeometry(n) {
    if (GEO[n]) return GEO[n];
    const span = (2 * Math.PI) / n, ri = R_IN + CORNER, ro = R_OUT - CORNER, g = GAP / 2 + CORNER, out = [];
    for (let i = 0; i < n; i++) {
      const mid = i * span, a0 = mid - span / 2, a1 = mid + span / 2;
      if (n === 1) {
        const ring = (d) => { const p = new Path2D(); p.arc(0, 0, R_OUT - d, 0, 7); p.moveTo(R_IN + d, 0); p.arc(0, 0, R_IN + d, 0, 7); return p; };
        out.push({ path: ring(0), inset: ring(6), rule: "evenodd", c: pt((R_IN + R_OUT) / 2, 0), mid: 0, box: [-R_OUT, -R_OUT, 2 * R_OUT, 2 * R_OUT] });
        continue;
      }
      const oo = Math.asin(Math.min(0.99, g / ro)), io = Math.asin(Math.min(0.99, g / ri)), pts = [], steps = 36;
      for (let k = 0; k <= steps; k++) pts.push(pt(ro, a0 + oo + ((a1 - a0 - 2 * oo) * k) / steps));
      for (let k = 0; k <= steps; k++) pts.push(pt(ri, a1 - io - ((a1 - a0 - 2 * io) * k) / steps));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const box = [Math.min(...xs) - CORNER, Math.min(...ys) - CORNER, 0, 0];
      box[2] = Math.max(...xs) + CORNER - box[0]; box[3] = Math.max(...ys) + CORNER - box[1];
      const rc = (R_IN + R_OUT) / 2 + (n <= 4 ? 4 : 0);
      out.push({ path: grow(pts, CORNER), inset: grow(pts, CORNER - 6), rule: "nonzero", c: pt(rc, mid), mid, box });
    }
    return (GEO[n] = out);
  }
  function roundRect(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }

  // upright tiles on one arc around `mid`, just apart, radius just big enough to clear the disc
  const FANS = {};
  function fanLayout(mid, widths) {
    const key = mid.toFixed(5) + "|" + widths.join(",");
    if (FANS[key]) return FANS[key];
    const hh = TILE_H / 2;
    const rectAt = (radius, a, w) => { const c = pt(radius, a); return { x: c.x - w / 2, y: c.y - hh, w, h: TILE_H }; };
    const apart = (r1, r2) => Math.abs(r1.x + r1.w / 2 - (r2.x + r2.w / 2)) >= (r1.w + r2.w) / 2 + TILE_GAP || Math.abs(r1.y - r2.y) >= TILE_H + TILE_GAP;
    const place = (radius, a0) => {
      const angles = [a0];
      for (let i = 1; i < widths.length; i++) {
        let a = angles[i - 1];
        while (!apart(rectAt(radius, angles[i - 1], widths[i - 1]), rectAt(radius, a, widths[i]))) a += 0.003;
        angles.push(a);
      }
      return angles;
    };
    const spread = (radius) => {
      let a0 = mid;
      for (let k = 0; k < 5; k++) { const an = place(radius, a0); a0 -= (an[0] + an[an.length - 1]) / 2 - mid; }
      return place(radius, a0);
    };
    const reachOf = (angles) => Math.max(...angles.map((a, i) => (widths[i] / 2) * Math.abs(Math.sin(a)) + hh * Math.abs(Math.cos(a))));
    let radius = R_DISC + FAN_CLEAR + hh;
    for (let k = 0; k < 6; k++) {
      const need = R_DISC + FAN_CLEAR + reachOf(spread(radius));
      if (Math.abs(need - radius) < 0.5) break;
      radius = need;
    }
    const angles = spread(radius);
    radius = Math.max(radius, R_DISC + FAN_CLEAR + reachOf(angles));
    return (FANS[key] = angles.map((a, i) => rectAt(radius, a, widths[i])));
  }

  /* ───────── icons (24-unit outline glyphs) ───────── */
  const ICONS = {
    edit: "M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4z",
    spark: "M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 11l5.6-2z",
    zip: "M8.5 3h7A2.5 2.5 0 0 1 18 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18.5v-13A2.5 2.5 0 0 1 8.5 3zM12 3v3m0 2v2m0 2v2M11.3 14h1.4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z",
    pages: "M10 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 7v12.5A1.5 1.5 0 0 0 6.5 21H16",
    stamp: "M9.5 13V9.5a2.5 2.5 0 1 1 5 0V13M4.5 13h15v4h-15zM6 20.5h12",
    lock: "M7 10.5h10a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18v-5A2.5 2.5 0 0 1 7 10.5zM8 10.5V7.5a4 4 0 0 1 8 0v3",
    compress: "M12 3v6m0 0-3-3m3 3 3-3M12 21v-6m0 0-3 3m3-3 3 3M4 12h16",
    film: "M5.5 4.5h13A2.5 2.5 0 0 1 21 7v10a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17V7a2.5 2.5 0 0 1 2.5-2.5zM3 9h18M3 15h18M8 4.5v15M16 4.5v15",
    mute: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5m0-5-5 5",
    wave: "M3 12h1.5M7 8v8M10.5 5v14M14 9v6M17.5 6.5v11M21 12h-1",
    unzip: "M4 8.5 12 4l8 4.5v7L12 20l-8-4.5zM12 11v6m-2.5-2.5L12 17l2.5-2.5",
  };
  const ICON_PATHS = Object.fromEntries(Object.entries(ICONS).map(([k, d]) => [k, new Path2D(d)]));

  /* ───────── what the wheel offers (formats.py plan_for, per kind of file) ───────── */
  const G = (label, icon, kids) => ({ label, icon, kids });
  const PLANS = {
    photo: { file: "Lago di Braies.jpg", pages: [["CONVERT", ["PNG", "WEBP", "HEIC", "AVIF", "PDF", "TIFF", "BMP", "ICO"].map((l) => G(l))],
      ["TOOLS", [G("EDIT", "edit", ["CROP", "RESIZE", "REMOVE BG", "ADD BG", "ROTATE"]), G("OPTIMIZE", "spark", ["COMPRESS", "STRIP INFO"]), G("ZIP", "zip")]]] },
    pdf: { file: "Alps Travel Guide.pdf", pages: [["CONVERT", [G("DOCX", null, ["DOCX", "DOCX + OCR"]), ...["JPG", "PNG", "TXT", "WEBP", "TIFF"].map((l) => G(l))]],
      ["TOOLS", [G("PAGES", "pages", ["SPLIT", "ORGANIZE", "ROTATE"]), G("STAMP", "stamp", ["PAGE NUMBERS", "WATERMARK"]), G("ADD PASSWORD", "lock"), G("COMPRESS", "compress"), G("ZIP", "zip")]]] },
    video: { file: "Hike.mp4", pages: [["CONVERT", ["WEBM", "MOV", "MKV", "GIF", "MP3", "WAV"].map((l) => G(l))],
      ["TOOLS", [G("EDIT VIDEO", "film"), G("SHRINK", "compress", ["COMPRESS", "HALF SIZE"]), G("MUTE", "mute"), G("ZIP", "zip")]]] },
    audio: { file: "Lofi loop.mp3", pages: [["CONVERT", ["WAV", "M4A", "OGG", "FLAC", "OPUS"].map((l) => G(l))],
      ["TOOLS", [G("COMPRESS", "compress"), G("NORMALIZE", "wave"), G("ZIP", "zip")]]] },
    docx: { file: "Notes.docx", pages: [["CONVERT", ["PDF", "TXT", "HTML", "MD"].map((l) => G(l))], ["TOOLS", [G("ZIP", "zip")]]] },
    slides: { file: "Pitch deck.pptx", pages: [["CONVERT", ["PDF", "JPG", "PNG"].map((l) => G(l))], ["TOOLS", [G("ZIP", "zip")]]] },
    text: { file: "README.md", pages: [["CONVERT", ["PDF", "DOCX", "HTML", "TXT"].map((l) => G(l))], ["TOOLS", [G("ZIP", "zip")]]] },
    archive: { file: "Photos.zip", pages: [["TOOLS", [G("EXTRACT", "unzip")]]] },
    other: { file: "Project folder", pages: [["TOOLS", [G("ZIP", "zip")]]] },
  };
  const KINDS = [["photo", "Photo"], ["pdf", "PDF"], ["video", "Video"], ["audio", "Audio"], ["docx", "Word"], ["slides", "Slides"], ["text", "Text"], ["archive", "Zip"]];
  const EXT_KIND = {};
  "png jpg jpeg webp heic heif avif bmp tif tiff gif ico".split(" ").forEach((e) => (EXT_KIND[e] = "photo"));
  "mp4 mov mkv webm avi m4v wmv".split(" ").forEach((e) => (EXT_KIND[e] = "video"));
  "mp3 wav m4a ogg flac opus aac wma".split(" ").forEach((e) => (EXT_KIND[e] = "audio"));
  "pptx ppt odp".split(" ").forEach((e) => (EXT_KIND[e] = "slides"));
  "zip tar gz tgz bz2 xz".split(" ").forEach((e) => (EXT_KIND[e] = "archive"));
  Object.assign(EXT_KIND, { pdf: "pdf", docx: "docx", txt: "text", md: "text" });
  const EDITORS = { CROP: "Crop", RESIZE: "Resize", "ADD BG": "Add BG", SPLIT: "Split PDF", ORGANIZE: "Organize pages", "PAGE NUMBERS": "Page numbers",
    WATERMARK: "Watermark", "ADD PASSWORD": "Add a password", "EDIT VIDEO": "Edit video" };

  /* ───────── backdrop images (stage + pre-blurred glass layers) ───────── */
  const img = (src) => { const i = new Image(); i.decoding = "async"; i.src = src; return i; };
  const stageImg = img("img/stage.webp");
  const GLASS = {};
  const frostTag = (f) => String(f).replace(".", "");
  function glassLayers(f) {
    const tag = frostTag(f);
    if (!GLASS[tag]) {
      const back = img(`img/glass-back-${tag}.webp`), lens = img(`img/glass-lens-${tag}.webp`);
      GLASS[tag] = { back, lens, lum: null };
      [back, lens, stageImg].forEach((i) => i.addEventListener("load", () => { invalidate(); }, { once: true }));
    }
    return GLASS[tag];
  }
  const ready = (i) => i && i.complete && i.naturalWidth > 0;
  function lensLight(c) {
    // is the glass behind this point light? (the app samples its lens image the same way)
    const L = glassLayers(th.frost);
    if (!ready(L.lens)) return true;
    if (!L.lum) {
      const cv = document.createElement("canvas"); cv.width = cv.height = 160;
      const x = cv.getContext("2d", { willReadFrequently: true });
      x.drawImage(L.lens, 0, 0, 160, 160);
      try { L.lum = x.getImageData(0, 0, 160, 160).data; } catch (e) { return true; }
    }
    const u = Math.round(((c.x + SPAN / 2) / SPAN) * 159), v = Math.round(((c.y + SPAN / 2) / SPAN) * 159);
    const i = (clamp(v, 0, 159) * 160 + clamp(u, 0, 159)) * 4, d = L.lum;
    const tint = th.segTop, k = tint.a / 255;
    const r = d[i] * (1 - k) + tint.r * k, g = d[i + 1] * (1 - k) + tint.g * k, b = d[i + 2] * (1 - k) + tint.b * k;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.58;
  }

  /* ───────── state ───────── */
  let themeKey = PRESETS[store.get("fs-wheel")] ? store.get("fs-wheel") : "smoke";
  let th = build(PRESETS[themeKey]);
  let kind = "photo", fileName = PLANS.photo.file;
  let t = 0, last = performance.now();
  let state = "open", page = 0, segs = [], outSegs = [], outT0 = 0, outN = 0;
  let openT0 = 0, closeT0 = null, flipT0 = -10, resultT0 = null, result = null, busyIdx = -1, busyLabel = "";
  let hoverIdx = -1, hubHover = false, hubAnim = 0, dwell = 0, dwellT0 = null, dwellLock = false, dim = 1, spin = 0;
  let fanIdx = -1, fanMid = 0, fanTiles = [], fanRects = [], fanHover = -1, fanGraceT0 = null, fanOut = null;
  let pointerType = "mouse", reopenTimer = null, stageScale = 1;
  const pages = () => PLANS[kind].pages;
  const pageActions = () => pages()[page][1];

  function open() {
    clearTimeout(reopenTimer);
    state = "open"; page = 0; openT0 = t; closeT0 = null; resultT0 = null; result = null; busyIdx = -1;
    hoverIdx = -1; fanIdx = -1; fanTiles = []; fanOut = null; dim = 1; dwell = 0; dwellLock = false; outSegs = [];
    const start = openT0 + 0.06;
    segs = pageActions().map((a, i) => ({ a, t0: start + i * 0.034, hover: 0, flash: 0 }));
    stage.classList.remove("showing-result");
  }
  function flip() {
    if (pages().length < 2 || state !== "open") return;
    closeFan();
    outSegs = segs; outN = segs.length; outT0 = t;
    page = (page + 1) % pages().length;
    segs = pageActions().map((a, i) => ({ a, t0: t + 0.07 + i * 0.03, hover: 0, flash: 0 }));
    flipT0 = t; hoverIdx = -1;
  }
  function measure(text, font) { ctx.save(); ctx.font = font; setSpacing(ctx, font === F_HUB ? 1.4 : 1.1); const w = ctx.measureText(text).width; ctx.restore(); return w; }
  function openFan(i) {
    if (i === fanIdx) return;
    closeFan();
    const kids = segs[i].a.kids, midJ = (kids.length - 1) / 2;
    fanIdx = i; fanMid = (i * 2 * Math.PI) / segs.length;
    fanTiles = kids.map((label, j) => ({ label, t0: t + 0.03 * Math.abs(j - midJ), hover: 0, flash: 0 }));
    fanRects = fanLayout(fanMid, kids.map((k) => Math.round(measure(k, F_LABEL) + 2 * TILE_PAD)));
    fanGraceT0 = null;
  }
  function closeFan() {
    if (fanIdx >= 0) fanOut = { tiles: fanTiles, rects: fanRects, t0: t };
    fanIdx = -1; fanTiles = []; fanRects = []; fanHover = -1; fanGraceT0 = null;
  }
  function run(segIndex, label) {
    if (state !== "open") return;
    state = "busy"; busyIdx = segIndex; busyLabel = label;
    if (segs[segIndex]) segs[segIndex].flash = 1;
    if (fanIdx >= 0) fanGraceT0 = t - FAN_GRACE + 0.18;      // let the chosen tile flash, then fold the fan
    setTimeout(() => {
      if (state !== "busy") return;
      state = "done"; resultT0 = t; result = resultFor(label);
      stage.classList.add("showing-result");
      announce.textContent = `${result[0]}. ${result[1]}`;
    }, reduced ? 200 : 900);
  }
  function dismiss() {
    if (closeT0 !== null) return;
    state = "closing"; closeT0 = t;
    reopenTimer = setTimeout(open, reduced ? 100 : 650);
  }
  function resultFor(label) {
    const stem = fileName.replace(/\.[^.]+$/, ""), ext = (fileName.includes(".") ? fileName.split(".").pop() : "").toLowerCase();
    if (EDITORS[label]) return [`Opens the ${EDITORS[label]} window`, "Make your changes, then save"];
    if (pages()[page][0] === "CONVERT") return [`Saved ${stem}.${label === "DOCX + OCR" ? "docx" : label.toLowerCase()}`, "Click to show in folder"];
    const names = { "REMOVE BG": `${stem} No BG.png`, ZIP: `${stem}.zip`, EXTRACT: `${stem} (extracted)`, COMPRESS: `${stem} compressed.${ext}`,
      "STRIP INFO": `${stem} clean.${ext}`, ROTATE: `${stem} rotated.${ext}`, MUTE: `${stem} muted.${ext}`, "HALF SIZE": `${stem} half.${ext}`, NORMALIZE: `${stem} normalized.${ext}` };
    return [`Saved ${names[label] || `${stem} ${label.toLowerCase()}.${ext}`}`, "Click to show in folder"];
  }

  /* ───────── tick (wheel.py _tick) ───────── */
  function tick(dtReal) {
    const dt = clamp(dtReal * TEMPO, 0, 0.05 * TEMPO);
    t += dt;
    const active = state === "open";
    segs.forEach((s, i) => {
      const chosen = i === busyIdx;
      const target = (active && (i === hoverIdx || i === fanIdx)) || chosen ? 1 : 0;
      s.hover = approach(s.hover, target, target ? 22 : 14, dt);
      s.flash = approach(s.flash, 0, 5.5, dt);
    });
    fanTiles.forEach((s, j) => { s.hover = approach(s.hover, active && j === fanHover ? 1 : 0, 24, dt); s.flash = approach(s.flash, 0, 5.5, dt); });
    if (fanGraceT0 !== null && t - fanGraceT0 > FAN_GRACE) closeFan();
    if (fanOut && t - fanOut.t0 > 0.2) fanOut = null;
    hubAnim = approach(hubAnim, hubHover && active ? 1 : 0, 16, dt);
    if (active && pages().length > 1 && hubHover && !dwellLock && pointerType !== "touch") {
      if (dwellT0 === null) dwellT0 = t;
      dwell = clamp((t - dwellT0 - 0.1) / 0.5);
      if (dwell >= 1) { flip(); dwellLock = true; dwellT0 = null; }
    } else { dwellT0 = null; dwell = approach(dwell, 0, 14, dt); }
    dim = approach(dim, state === "busy" || state === "done" ? 0.32 : 1, 10, dt);
    if (state === "busy") spin = (spin + dt * 300) % 360;
    if (state === "done" && t - resultT0 > 2.2) dismiss();
  }

  /* ───────── painting ───────── */
  function setSpacing(c, px) { if ("letterSpacing" in c) c.letterSpacing = `${px}px`; }
  const caches = new Map();
  function invalidate() { caches.clear(); }
  function cached(key, box, paint) {
    let cv = caches.get(key);
    if (!cv) {
      const k = stageScale * (window.devicePixelRatio || 1);
      cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.ceil(box[2] * k)); cv.height = Math.max(1, Math.ceil(box[3] * k));
      const c = cv.getContext("2d");
      c.setTransform(k, 0, 0, k, -box[0] * k, -box[1] * k);
      paint(c);
      caches.set(key, cv);
    }
    ctx.drawImage(cv, box[0], box[1], box[2], box[3]);
  }
  function material(c) { return lum(c) > 0.5 ? [0.55, 0.75, 0.9] : [0.32, 0.42, 2.2]; }
  function edgeLight(c, path, box, s = 1, rimK = 1, shadeK = 1, rule = "nonzero") {
    const a = (v) => Math.max(0, Math.min(255, v)) / 255;
    c.save();
    c.clip(path, rule);
    c.lineJoin = "round";
    c.strokeStyle = `rgba(255,255,255,${a(70 * s)})`; c.lineWidth = 7; c.stroke(path);
    c.translate(0, 1.6); c.strokeStyle = `rgba(255,255,255,${a(190 * s)})`; c.lineWidth = 1.6; c.stroke(path);
    c.translate(0, -3.6); c.strokeStyle = `rgba(0,0,0,${a(34 * s * shadeK)})`; c.lineWidth = 2.2; c.stroke(path);
    c.restore();
    const g = c.createLinearGradient(box[0], box[1], box[0] + box[2], box[1] + box[3]);
    g.addColorStop(0, `rgba(255,255,255,${a(245 * rimK)})`); g.addColorStop(0.45, `rgba(255,255,255,${a(80 * rimK)})`);
    g.addColorStop(0.8, `rgba(255,255,255,${a(60 * rimK)})`); g.addColorStop(1, `rgba(255,255,255,${a(190 * rimK)})`);
    c.lineJoin = "round"; c.strokeStyle = g; c.lineWidth = 1.15; c.stroke(path);
    c.save(); c.translate(0, 0.9); c.strokeStyle = `rgba(0,0,0,${a(30 * shadeK)})`; c.lineWidth = 0.8; c.stroke(path); c.restore();
  }
  function drawLens(c, path, center, zoom, rule = "nonzero") {
    const L = glassLayers(th.frost);
    if (!ready(L.lens)) return;
    c.save();
    c.clip(path, rule);
    c.translate(center.x, center.y); c.scale(zoom, zoom); c.translate(-center.x, -center.y);
    c.drawImage(L.lens, -SPAN / 2, -SPAN / 2, SPAN, SPAN);
    c.restore();
  }
  function glassPiece(c, path, inset, center, box, heat, rule) {
    const zoom = 1.06 + 0.05 * heat;
    drawLens(c, path, center, zoom + 0.09, rule);          // glass bends light hardest near its rim
    drawLens(c, inset, center, zoom, rule);
    const g = c.createLinearGradient(0, box[1], 0, box[1] + box[3]);
    g.addColorStop(0, css(mix(th.segTop, th.hotA, heat))); g.addColorStop(1, css(mix(th.segBot, th.hotB, heat)));
    c.fillStyle = g; c.fill(path, rule);
    edgeLight(c, path, box, 1 + 0.4 * heat, 1, 1, rule);
    c.lineWidth = 1;
    c.save(); c.translate(-0.8, -0.5); c.strokeStyle = "rgba(110,210,255,0.22)"; c.stroke(path); c.restore();
    c.save(); c.translate(0.8, 0.6); c.strokeStyle = "rgba(255,130,180,0.18)"; c.stroke(path); c.restore();
  }
  function glow(c, path, widths) {
    c.save(); c.lineJoin = "round"; c.strokeStyle = css(th.glow);
    widths.forEach(([w, al]) => { c.globalAlpha = clamp(al * th.glowK); c.lineWidth = w; c.stroke(path); });
    c.restore();
  }
  function segBody(c, geo, heat) {
    if (heat > 0) glow(c, geo.path, [[18, 0.03], [11, 0.05], [5, 0.08]]);
    if (th.glass) { glassPiece(c, geo.path, geo.inset, geo.c, geo.box, heat, geo.rule); return; }
    const g = c.createLinearGradient(0, -R_OUT, 0, R_OUT);
    g.addColorStop(0, css(th.segTop)); g.addColorStop(1, css(th.segBot));
    c.fillStyle = g; c.fill(geo.path, geo.rule);
    if (heat > 0) {
      const h = c.createRadialGradient(geo.c.x, geo.c.y - 18, 0, geo.c.x, geo.c.y - 18, 150);
      h.addColorStop(0, css(th.hotA)); h.addColorStop(1, css(th.hotB));
      c.fillStyle = h; c.fill(geo.path, geo.rule);
    }
    const m = material(heat > 0 ? th.hotB : th.segTop);
    edgeLight(c, geo.path, geo.box, m[0] + (heat > 0 ? 0.15 : 0), m[1], m[2], geo.rule);
  }
  function tileBody(c, r, heat) {
    const path = roundRect(r.x, r.y, r.w, r.h, TILE_H / 2), rad = TILE_H / 2;
    [20, 12, 6].forEach((al, i) => {
      const g = 0.5 + i * 1.8;
      c.fillStyle = `rgba(0,0,0,${al / 255})`;
      c.fill(roundRect(r.x - g, r.y - g + 2 + i * 1.2, r.w + 2 * g, r.h + 2 * g, rad + g));
    });
    if (heat > 0) glow(c, path, [[12, 0.04], [7, 0.06], [3, 0.09]]);
    const box = [r.x, r.y, r.w, r.h], center = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    if (th.glass) { glassPiece(c, path, roundRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, rad - 6), center, box, heat, "nonzero"); return; }
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, css(th.segTop)); g.addColorStop(1, css(th.segBot));
    c.fillStyle = g; c.fill(path);
    if (heat > 0) {
      const h = c.createRadialGradient(center.x, center.y - 10, 0, center.x, center.y - 10, r.w * 0.75);
      h.addColorStop(0, css(th.hotA)); h.addColorStop(1, css(th.hotB));
      c.fillStyle = h; c.fill(path);
    }
    const m = material(heat > 0 ? th.hotB : th.segTop);
    edgeLight(c, path, box, m[0] + (heat > 0 ? 0.15 : 0), m[1], m[2]);
  }
  function ringBody(c) {
    // soft shadow, then the disc (solid, or blurred backdrop + tint), then the well around the hub
    const sh = th.shadow;
    let g = c.createRadialGradient(0, 16, 0, 0, 16, R_DISC + 40);
    let edge = (R_DISC - 26) / (R_DISC + 40);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(edge * 0.8, `rgba(0,0,0,${sh / 255})`);
    g.addColorStop(edge, `rgba(0,0,0,${(sh * 0.87) / 255})`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 16, R_DISC + 40, 0, 7); c.fill();
    edge = R_DISC / (R_DISC + 9);
    g = c.createRadialGradient(0, 5, 0, 0, 5, R_DISC + 9);
    g.addColorStop(edge * 0.94, "rgba(0,0,0,0)"); g.addColorStop(edge, `rgba(0,0,0,${(sh * 0.9) / 255})`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 5, R_DISC + 9, 0, 7); c.fill();
    const disc = new Path2D(); disc.arc(0, 0, R_DISC, 0, 7);
    const box = [-R_DISC, -R_DISC, 2 * R_DISC, 2 * R_DISC];
    if (th.glass) {
      const L = glassLayers(th.frost);
      if (ready(L.back)) { c.save(); c.clip(disc); c.drawImage(L.back, -SPAN / 2, -SPAN / 2, SPAN, SPAN); c.restore(); }
      g = c.createLinearGradient(0, -R_DISC, 0, R_DISC);
      g.addColorStop(0, css(th.discA)); g.addColorStop(1, css(th.discB));
      c.fillStyle = g; c.fill(disc);
      edgeLight(c, disc, box, 1.1);
    } else {
      g = c.createLinearGradient(-R_DISC, -R_DISC, R_DISC, R_DISC);
      g.addColorStop(0, css(th.discA)); g.addColorStop(1, css(th.discB));
      c.fillStyle = g; c.fill(disc);
      c.save(); c.clip(disc);
      const s = c.createRadialGradient(-R_DISC * 0.35, -R_DISC * 0.75, 0, -R_DISC * 0.35, -R_DISC * 0.75, R_DISC * 1.1);
      s.addColorStop(0, css(th.sheen)); s.addColorStop(1, css(A(th.sheen, 0)));
      c.fillStyle = s; c.fill(disc); c.restore();
      const m = material(th.discA);
      edgeLight(c, disc, box, m[0], m[1] + 0.15, m[2]);
    }
    c.fillStyle = css(th.well); c.beginPath(); c.arc(0, 0, HUB + 11, 0, 7); c.fill();
    c.strokeStyle = css(th.wellRim); c.lineWidth = 1.2; c.stroke();
  }
  function hubBody(c) {
    const ball = new Path2D(); ball.arc(0, 0, HUB, 0, 7);
    if (th.glass) {
      drawLens(c, ball, { x: 0, y: 0 }, 1);
      c.fillStyle = css(A(th.hotB, 120)); c.fill(ball);
      c.strokeStyle = "rgba(255,255,255,0.43)"; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, HUB - 0.5, 0, 7); c.stroke();
      return;
    }
    c.fillStyle = css(mix(th.hotA, th.hotB, 0.5)); c.fill(ball);
  }

  function inkFor(c, h) {
    let base = th.ink, halo = null;
    if (th.glass) {
      const light = lensLight(c);
      base = light ? th.ink : W_;
      halo = light || h > 0.5 ? "rgba(255,255,255,0.27)" : "rgba(0,0,0,0.31)";
    }
    return [css(mix(base, th.hotInk, h)), halo];
  }
  function label(text, icon, group, color, halo) {
    ctx.font = F_LABEL; setSpacing(ctx, 1.1);
    const tw = ctx.measureText(text).width, ty = icon ? 16 : 4.6;
    const drawIcon = (y, stroke) => {
      ctx.save(); ctx.translate(-10, y); ctx.scale(20 / 24, 20 / 24);
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(ICON_PATHS[icon]); ctx.restore();
    };
    if (halo) { ctx.fillStyle = halo; ctx.fillText(text, -tw / 2, ty + 0.9); if (icon) drawIcon(-21, halo); }
    if (icon) drawIcon(-22, color);
    ctx.fillStyle = color; ctx.fillText(text, -tw / 2, ty);
    if (group) [-6, 0, 6].forEach((dx) => { ctx.beginPath(); ctx.arc(dx, ty + 8, 1.6, 0, 7); ctx.fill(); });
  }
  function paintSeg(geo, s, i, n, op, radial, sc, rot, grot, ga) {
    if (op <= 0.002) return;
    const h = clamp(s.hover), heat = Math.max(h, s.flash * 0.6);
    ctx.save();
    ctx.translate(Math.sin(geo.mid) * radial, -Math.cos(geo.mid) * radial);
    ctx.translate(geo.c.x, geo.c.y); ctx.scale(sc, sc); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-geo.c.x, -geo.c.y);
    const restBox = [geo.box[0] - 3, geo.box[1] - 3, geo.box[2] + 6, geo.box[3] + 6];
    const hotBox = [geo.box[0] - 14, geo.box[1] - 14, geo.box[2] + 28, geo.box[3] + 28];
    ctx.globalAlpha = ga * op;
    cached(`seg|${n}|${i}|0`, restBox, (c) => segBody(c, geo, 0));
    if (heat > 0.005) {
      ctx.globalAlpha = ga * op * clamp(heat);
      cached(`seg|${n}|${i}|1`, hotBox, (c) => segBody(c, geo, 1));
      ctx.globalAlpha = ga * op;
    }
    ctx.translate(geo.c.x, geo.c.y);
    ctx.rotate(((-rot - grot) * Math.PI) / 180);                        // the label stays upright
    const [color, halo] = inkFor(geo.c, h);
    label(s.a.label, s.a.icon, !!s.a.kids, color, halo);
    ctx.restore();
  }
  function paintTile(r, s, op, k, sc, ga) {
    if (op <= 0.002) return;
    const h = clamp(s.hover), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.save();
    ctx.translate(cx * k, cy * k); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    const box = [r.x - 12, r.y - 12, r.w + 24, r.h + 26];
    const key = `tile|${Math.round(r.x)}|${Math.round(r.y)}|${Math.round(r.w)}`;
    ctx.globalAlpha = ga * op;
    cached(key + "|0", box, (c) => tileBody(c, r, 0));
    const heat = Math.max(h, s.flash * 0.6);
    if (heat > 0.005) { ctx.globalAlpha = ga * op * clamp(heat); cached(key + "|1", box, (c) => tileBody(c, r, 1)); ctx.globalAlpha = ga * op; }
    ctx.translate(cx, cy);
    const [color, halo] = inkFor({ x: cx, y: cy }, h);
    ctx.font = F_LABEL; setSpacing(ctx, 1.1);
    const tw = ctx.measureText(s.label).width;
    if (halo) { ctx.fillStyle = halo; ctx.fillText(s.label, -tw / 2, 4.6 + 0.9); }
    ctx.fillStyle = color; ctx.fillText(s.label, -tw / 2, 4.6);
    ctx.restore();
  }
  function paintHub(ga) {
    const resE = resultT0 !== null ? t - resultT0 : 0;
    const bounce = resultT0 !== null ? 0.09 * Math.sin(clamp(resE / 0.38) * Math.PI) * (1 - clamp(resE / 0.6)) : 0;
    const flipPop = 0.06 * Math.sin(clamp((t - flipT0) / 0.35) * Math.PI);
    const intro = easeOutBack((t - openT0) / 0.45, 2.0);
    const r = HUB * lerp(0.4, 1, intro) * (1 + 0.05 * hubAnim + bounce + flipPop);
    ctx.globalAlpha = ga;
    ctx.save(); ctx.scale(r / HUB, r / HUB);
    cached("hub", [-HUB - 4, -HUB - 4, 2 * HUB + 8, 2 * HUB + 8], hubBody);
    ctx.restore();
    if ((state === "open" || state === "closing") && resultT0 === null && busyIdx < 0) hubPill(r, ga);
    else if (state === "busy" || (busyIdx >= 0 && resultT0 === null)) spinner(r);
    else if (resultT0 !== null) check(resE);
  }
  function hubPill(r, ga) {
    const names = pages().map((p) => p[0]);
    const lab = names[page], nxt = names.length > 1 ? names[(page + 1) % names.length] : null;
    ctx.font = F_HUB; setSpacing(ctx, 1.4);
    const textW = Math.max(ctx.measureText(lab).width, nxt ? ctx.measureText(nxt).width : 0);
    const pw = (Math.max(98, Math.min(2 * HUB - 4, textW + 30)) * r) / HUB, ph = (36 * r) / HUB;
    const x = -pw / 2, y = -ph / 2 - (nxt ? 5 : 0);
    ctx.fillStyle = "rgba(0,0,0,0.157)"; ctx.fill(roundRect(x, y + 2, pw, ph, ph / 2));
    ctx.fillStyle = css(th.hubPillBg); ctx.fill(roundRect(x, y, pw, ph, ph / 2));
    const d = nxt ? dwell : 0, cy = y + ph / 2;
    ctx.save(); ctx.clip(roundRect(x, y, pw, ph, ph / 2));
    [[lab, -d * 14, 1 - d], [nxt, (1 - d) * 14, d]].forEach(([text, off, al]) => {
      if (!text || al <= 0.01) return;
      ctx.globalAlpha = ga * al; ctx.fillStyle = css(th.hubPillInk);
      ctx.fillText(text, -ctx.measureText(text).width / 2, cy + 4.4 + off);
    });
    ctx.restore(); ctx.globalAlpha = ga;
    if (nxt) names.forEach((_, i) => {
      const on = i === page, w = on ? 14 : 6, dx = (i - (names.length - 1) / 2) * 13;
      ctx.fillStyle = css(A(th.hubFg, on ? 255 : 120));
      ctx.fill(roundRect(dx - w / 2, y + ph + 8, w, 6, 3));
    });
    if (dwell > 0.01) {
      ctx.strokeStyle = css(th.hotB); ctx.lineWidth = 3.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, HUB + 11, -Math.PI / 2, -Math.PI / 2 + dwell * 2 * Math.PI); ctx.stroke();
    }
  }
  function spinner(r) {
    const rr = r - 9, fg = th.hubFg;
    ctx.lineWidth = 4; ctx.strokeStyle = css(A(fg, 60)); ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.stroke();
    const len = 70 + 50 * Math.sin(t * 3.1), start = ((-(90 - spin)) * Math.PI) / 180;
    ctx.strokeStyle = css(fg); ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0, rr, start, start + (len * Math.PI) / 180); ctx.stroke();
    ctx.font = F_HUB; setSpacing(ctx, 1.4); ctx.fillStyle = css(fg);
    const w = ctx.measureText(busyLabel).width;
    if (w < 2 * rr - 16) ctx.fillText(busyLabel, -w / 2, 4.4);
  }
  function check(k) {
    const f = easeOutCubic((k - 0.04) / 0.32), p = [[-14.5, 0.5], [-4.8, 10.2], [14.5, -9.8]];
    const L = [Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1])];
    let rem = f * (L[0] + L[1]);
    ctx.strokeStyle = css(th.hubFg); ctx.lineWidth = 3.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 0; i < 2 && rem > 0; i++) {
      const u = Math.min(1, rem / L[i]);
      ctx.lineTo(p[i][0] + (p[i + 1][0] - p[i][0]) * u, p[i][1] + (p[i + 1][1] - p[i][1]) * u);
      rem -= L[i];
    }
    ctx.stroke();
  }
  function ripple(ga) {
    if (resultT0 === null) return;
    [0, 0.14].forEach((delay) => {
      const k = clamp((t - resultT0 - delay) / 0.7);
      if (k <= 0 || k >= 1) return;
      const e = easeOutCubic(k);
      ctx.globalAlpha = ga; ctx.strokeStyle = css(A(th.hotB, 255 * 0.55 * (1 - e))); ctx.lineWidth = lerp(5, 1, e);
      ctx.beginPath(); ctx.arc(0, 0, lerp(HUB, R_DISC + 30, e), 0, 7); ctx.stroke();
    });
  }
  function pill(ga) {
    if (resultT0 === null || !result) return;
    const k = easeOutBack((t - resultT0 - 0.12) / 0.45, 1.3);
    if (k <= 0) return;
    const [title, sub] = result;
    ctx.font = F_PILL; const tw = ctx.measureText(title).width;
    ctx.font = F_PILL_SUB; const sw = ctx.measureText(sub).width;
    const pw = Math.min(SPAN - 24, Math.max(tw, sw) + 78), ph = 56, rad = ph / 2;
    const x = -pw / 2, y = PILL_Y - ph / 2 + (1 - clamp(k)) * 12;
    ctx.save(); ctx.globalAlpha = clamp(k) * ga;
    [22, 16, 11, 7, 4].forEach((al, i) => {
      ctx.fillStyle = `rgba(0,0,0,${al / 255})`;
      ctx.fill(roundRect(x - i * 0.8, y + 1.5 + i * 1.3, pw + i * 1.6, ph + 0.5 + i * 0.4, rad + i));
    });
    ctx.fillStyle = css(th.pillBg); ctx.fill(roundRect(x, y, pw, ph, rad));
    ctx.strokeStyle = css(th.pillBorder); ctx.lineWidth = 1; ctx.stroke(roundRect(x + 0.5, y + 0.5, pw - 1, ph - 1, rad - 0.5));
    const cx = x + 28, cy = y + ph / 2;
    ctx.fillStyle = css(th.hotB); ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 7); ctx.fill();
    ctx.strokeStyle = css(th.hubFg); ctx.lineWidth = 2.1; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(cx - 5, cy + 0.3); ctx.lineTo(cx - 1.6, cy + 3.7); ctx.lineTo(cx + 5.2, cy - 3.4); ctx.stroke();
    ctx.font = F_PILL; ctx.fillStyle = css(th.pillTitle); ctx.fillText(title, cx + 22, cy - 3);
    ctx.font = F_PILL_SUB; ctx.fillStyle = css(th.pillSub); ctx.fillText(sub, cx + 22, cy + 14);
    ctx.restore();
  }

  function frame() {
    const k = stageScale * (window.devicePixelRatio || 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height / 2);
    if (ready(stageImg)) ctx.drawImage(stageImg, -SPAN / 2, -SPAN / 2, SPAN, SPAN);

    const o = (t - openT0) / 0.5;
    let scale = lerp(0.62, 1, easeOutBack(o, 1.55)), alpha = easeOutCubic((t - openT0) / 0.2), rot = lerp(-18, 0, easeOutCubic(o));
    if (closeT0 !== null) {
      const c = (t - closeT0) / 0.22;
      scale *= lerp(1, 0.82, easeInCubic(c)); alpha *= 1 - easeInCubic(c); rot += lerp(0, 8, easeInCubic(c));
    }
    if (alpha <= 0.001) return;
    const rad = (rot * Math.PI) / 180;
    ctx.save();
    ctx.scale(scale, scale);
    // fan under the disc, so tiles slide out from beneath it
    ctx.save(); ctx.rotate(rad);
    if (fanOut) {
      const e = easeInCubic((t - fanOut.t0) / 0.18);
      fanOut.rects.forEach((r, j) => paintTile(r, fanOut.tiles[j], 1 - e, lerp(1, 0.8, e), lerp(1, 0.7, e), alpha));
    }
    fanRects.forEach((r, j) => {
      const s = fanTiles[j], a = (t - s.t0) / 0.4;
      if (a <= 0) return;
      const e = easeOutBack(a, 1.6);
      paintTile(r, s, easeOutCubic(a * 1.8), lerp(0.74, 1, e) + 0.012 * s.hover, lerp(0.5, 1, e) * (1 + 0.05 * s.hover + 0.08 * s.flash), alpha);
    });
    ctx.restore();
    ctx.globalAlpha = alpha;
    const m = R_DISC + 52;
    cached("ring", [-m, -m, 2 * m, 2 * m + 14], ringBody);
    ctx.save(); ctx.rotate(rad);
    if (outSegs.length) {
      const a = (t - outT0) / 0.2;
      if (a >= 1) outSegs = [];
      else {
        const geo = segmentGeometry(outN), e = easeInCubic(a);
        outSegs.forEach((s, i) => paintSeg(geo[i], s, i, outN, 1 - e, -22 * e, 1 - 0.28 * e, 12 * e, rot, alpha));
      }
    }
    if (segs.length) {
      const geo = segmentGeometry(segs.length);
      segs.forEach((s, i) => {
        const a = (t - s.t0) / 0.5;
        if (a <= 0) return;
        const e = easeOutBack(a, 1.45);
        let op = easeOutCubic(a * 1.7);
        if (busyIdx >= 0 && i !== busyIdx) op *= dim;
        paintSeg(geo[i], s, i, segs.length, op, lerp(-34, 0, e) + 6 * s.hover,
          lerp(0.5, 1, e) * (1 + 0.035 * s.hover + 0.05 * s.flash), lerp(-16, 0, easeOutCubic(a)), rot, alpha);
      });
    }
    ctx.restore();
    paintHub(alpha);
    ripple(alpha);
    ctx.restore();
    pill(alpha);
  }

  /* ───────── input (wheel.py _hit / _update_hover / _steer_fan) ───────── */
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width - 0.5) * SPAN, y: ((e.clientY - r.top) / r.height - 0.5) * SPAN };
  }
  function hit(p) {
    const r = Math.hypot(p.x, p.y);
    if (r <= HUB + 10) return "hub";
    if (r >= R_IN - 8 && r <= R_DISC + 10 && segs.length) {
      const n = segs.length, span = (2 * Math.PI) / n;
      const a = (Math.atan2(p.x, -p.y) + 2 * Math.PI) % (2 * Math.PI);
      return Math.floor(((a + span / 2) % (2 * Math.PI)) / span) % n;
    }
    if (fanRects.length && r > R_DISC + 10) {
      for (let j = 0; j < fanRects.length; j++) {
        const f = fanRects[j];
        if (p.x >= f.x - 5 && p.x <= f.x + f.w + 5 && p.y >= f.y - 5 && p.y <= f.y + f.h + 5) return ["fan", j];
      }
      const off = (x, y) => ((Math.atan2(x, -y) - fanMid + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      const c0 = fanRects[0], c1 = fanRects[fanRects.length - 1];
      const half = Math.max(Math.abs(off(c0.x + c0.w / 2, c0.y + c0.h / 2)), Math.abs(off(c1.x + c1.w / 2, c1.y + c1.h / 2))) + 0.2;
      const far = Math.max(...fanRects.map((f) => Math.hypot(f.x + f.w / 2, f.y + f.h / 2) + f.w / 2));
      if (Math.abs(off(p.x, p.y)) <= half && r <= far) return "fanzone";
    }
    return null;
  }
  function updateHover(h) {
    hoverIdx = typeof h === "number" ? h : -1;
    fanHover = Array.isArray(h) ? h[1] : -1;
    if (state === "open" && pointerType !== "touch") {
      if (typeof h === "number" && segs[h].a.kids) { openFan(h); fanGraceT0 = null; }
      else if (Array.isArray(h) || h === "fanzone") fanGraceT0 = null;
      else if (fanIdx >= 0 && fanGraceT0 === null) fanGraceT0 = t;
    }
    const was = hubHover;
    hubHover = h === "hub";
    if (was && !hubHover) dwellLock = false;
    canvas.style.cursor = h === null || h === "fanzone" ? "default" : "pointer";
  }
  canvas.addEventListener("pointermove", (e) => { pointerType = e.pointerType; if (state === "open") updateHover(hit(local(e))); });
  canvas.addEventListener("pointerleave", () => updateHover(null));
  canvas.addEventListener("click", (e) => {
    if (state !== "open") return;
    const h = hit(local(e));
    if (h === "hub") { flip(); return; }
    if (Array.isArray(h)) { run(fanIdx, fanTiles[h[1]].label); return; }
    if (typeof h === "number") {
      const a = segs[h].a;
      if (a.kids) { if (fanIdx === h) closeFan(); else openFan(h); hoverIdx = h; }
      else run(h, a.label);
    }
  });
  // keyboard: arrows move between segments, Enter picks, Space flips the page
  canvas.addEventListener("keydown", (e) => {
    if (state !== "open") return;
    const n = segs.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { hoverIdx = (hoverIdx + 1 + n) % n; e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { hoverIdx = (hoverIdx - 1 + n) % n; e.preventDefault(); }
    else if (e.key === " ") { flip(); e.preventDefault(); return; }
    else if (e.key === "Enter" && hoverIdx >= 0) {
      const a = segs[hoverIdx].a;
      if (a.kids) run(hoverIdx, a.kids[0]); else run(hoverIdx, a.label);
      e.preventDefault(); return;
    } else return;
    announce.textContent = segs[hoverIdx].a.label;
  });
  const announce = document.createElement("p");
  announce.className = "sr"; announce.setAttribute("aria-live", "polite");
  stage.append(announce);

  /* ───────── controls: file kind, look ───────── */
  function setKind(k, name) {
    kind = k; fileName = name || PLANS[k].file;
    document.querySelectorAll("#kinds button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
    open();
  }
  const kinds = document.getElementById("kinds");
  KINDS.forEach(([k, n]) => {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: n });
    b.dataset.k = k; b.setAttribute("aria-pressed", String(k === kind));
    b.addEventListener("click", () => setKind(k));
    kinds?.append(b);
  });
  function setTheme(k) {
    themeKey = k; th = build(PRESETS[k]); store.set("fs-wheel", k);
    if (th.glass) glassLayers(th.frost);
    invalidate();
    document.querySelectorAll("[data-look]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.look === k)));
  }
  const glassRow = document.getElementById("glassLooks"), colourRow = document.getElementById("swatches");
  Object.entries(PRESETS).forEach(([k, p]) => {
    const b = Object.assign(document.createElement("button"), { type: "button" });
    b.dataset.look = k;
    b.setAttribute("aria-pressed", String(k === themeKey));
    if (p.glass) { b.textContent = p.n; b.className = `glass-chip g-${k}`; glassRow?.append(b); }
    else {
      b.title = p.n; b.setAttribute("aria-label", `${p.n} look`);
      b.style.setProperty("--a", p.ring); b.style.setProperty("--b", p.highlight);
      colourRow?.append(b);
    }
    b.addEventListener("click", () => setTheme(k));
  });
  if (th.glass) glassLayers(th.frost);

  // a real file dropped on the wheel: only its name is read
  ["dragenter", "dragover"].forEach((ev) => stage.addEventListener(ev, (e) => {
    if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "copy"; stage.classList.add("dragover");
  }));
  stage.addEventListener("dragleave", (e) => { if (!stage.contains(e.relatedTarget)) stage.classList.remove("dragover"); });
  stage.addEventListener("drop", (e) => {
    e.preventDefault(); stage.classList.remove("dragover");
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const ext = (f.name.includes(".") ? f.name.split(".").pop() : "").toLowerCase();
    setKind(EXT_KIND[ext] || "other", f.name);
  });
  ["dragover", "drop"].forEach((ev) => addEventListener(ev, (e) => { if (!stage.contains(e.target)) e.preventDefault(); }));

  /* ───────── sizing + loop ───────── */
  function resize() {
    const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    stageScale = r.width / SPAN;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    invalidate();
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  // animate only while the stage is on screen (a cheap check each frame)
  let wasVisible = false;
  const loop = (now) => {
    const r = stage.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < innerHeight && !document.hidden;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible) {
      if (!wasVisible) open();                     // bloom open each time it scrolls into view
      tick(dt);
      frame();
    }
    wasVisible = visible;
    requestAnimationFrame(loop);
  };
  open();
  frame();
  if (location.search.includes("wheeltest")) {
    // test hook: drive the clock and the pointer by hand, frame by frame
    window.__fsWheel = {
      step(sec) { tick(sec); frame(); },
      move(x, y) { pointerType = "mouse"; updateHover(hit({ x, y })); },
      click(x, y) { canvas.dispatchEvent(new MouseEvent("click", { clientX: canvas.getBoundingClientRect().left + (x / SPAN + 0.5) * canvas.getBoundingClientRect().width, clientY: canvas.getBoundingClientRect().top + (y / SPAN + 0.5) * canvas.getBoundingClientRect().height })); },
      open, setTheme, setKind, canvas,
    };
    return;
  }
  requestAnimationFrame(loop);
})();
