/* ============================================================
   VENTUREAST — motion choreography
   OS reduced-motion wins; the footer toggle can only re-enable
   within a session where the OS allows motion.
   ============================================================ */
(() => {
  const html = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, val); } catch { /* private mode */ } },
  };

  let motionOn = !motionQuery.matches && storage.get('ve-motion') !== 'off';
  html.dataset.motion = motionOn ? 'on' : 'off';

  /* ---------- Dynamic years (never rots) ---------- */
  const years = new Date().getFullYear() - 1997;
  const yearsEl = document.getElementById('yearsCount');
  if (yearsEl) yearsEl.dataset.count = String(years);
  const yEl = document.getElementById('year');
  if (yEl) yEl.textContent = String(new Date().getFullYear());

  /* ---------- Reveal on scroll ----------
     .reveal-ready gates the hiding CSS: if anything here throws,
     the page stays fully visible. */
  const reveals = document.querySelectorAll('.reveal');
  try {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      html.classList.add('reveal-ready');
      reveals.forEach((el) => io.observe(el));
    }
  } catch { /* degrade to visible page */ }

  /* ---------- Count-up stats ---------- */
  const counters = document.querySelectorAll('.count');
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const runCounter = (el) => {
    const target = parseFloat(el.dataset.count || '0');
    if (!motionOn) { el.textContent = String(target); return; }
    const dur = 1500;
    let start;
    const tick = (now) => {
      if (start === undefined) start = now;
      const p = Math.min((now - start) / dur, 1);
      el.textContent = String(Math.round(target * easeOutQuart(p)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
      }
    }, { threshold: 0.4 });
    counters.forEach((el) => cio.observe(el));
  } else {
    counters.forEach((el) => { el.textContent = el.dataset.count; });
  }

  /* ---------- Silk canvas (hero) ---------- */
  const canvas = document.getElementById('silk');
  let heroVisible = true;
  const silk = (() => {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let w, h, t = 0, raf = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const blobs = [
      { c: [190, 211, 195], r: 0.52, sx: 0.21, sy: 0.32, px: 0.22, py: 0.28, a: 0.5 },
      { c: [228, 217, 194], r: 0.6, sx: 0.14, sy: 0.2, px: 0.78, py: 0.24, a: 0.55 },
      { c: [205, 224, 210], r: 0.45, sx: 0.26, sy: 0.16, px: 0.62, py: 0.75, a: 0.42 },
      { c: [230, 211, 168], r: 0.38, sx: 0.18, sy: 0.26, px: 0.16, py: 0.8, a: 0.3 },
    ];
    const paint = (drift) => {
      ctx.clearRect(0, 0, w, h);
      for (const b of blobs) {
        const x = (b.px + (drift ? Math.sin(t * (1 + b.sx)) * b.sx * 0.6 : 0)) * w;
        const y = (b.py + (drift ? Math.cos(t * (1 + b.sy)) * b.sy * 0.6 : 0)) * h;
        const r = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${b.a})`);
        g.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    };
    const frame = () => { t += 0.0038; paint(true); raf = requestAnimationFrame(frame); };
    const start = () => { if (raf === null) raf = requestAnimationFrame(frame); };
    const stop = () => { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };
    const running = () => raf !== null;
    const paintOnce = () => paint(false);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running()) paintOnce(); // canvas clears on resize; repaint static frame
    };
    resize();
    window.addEventListener('resize', resize);
    return { start, stop, paintOnce, running };
  })();
  const syncSilk = () => {
    if (!silk) return;
    if (motionOn && heroVisible && !document.hidden) silk.start();
    else { silk.stop(); silk.paintOnce(); }
  };
  if (silk) {
    syncSilk();
    document.addEventListener('visibilitychange', syncSilk);
    // stop painting entirely once the hero scrolls out of view
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        syncSilk();
      }, { threshold: 0 }).observe(canvas);
    }
  }

  /* ---------- Scroll work: nav state, timeline, parallax ---------- */
  const nav = document.getElementById('nav');
  const tlSection = document.getElementById('timeline');
  const tlProgress = document.getElementById('tlProgress');
  const pxEls = Array.from(document.querySelectorAll('[data-parallax]'));
  let scrollRaf = null;
  const onScroll = () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      const vh = window.innerHeight;
      nav.classList.toggle('scrolled', window.scrollY > 24);
      if (tlSection && tlProgress) {
        if (motionOn) {
          const r = tlSection.getBoundingClientRect();
          const p = Math.min(Math.max((vh * 0.72 - r.top) / r.height, 0), 1);
          tlProgress.style.transform = `scaleY(${p})`;
        } else {
          tlProgress.style.transform = 'scaleY(1)'; // static full rail
        }
      }
      if (motionOn) {
        for (const el of pxEls) {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh) continue;
          const p = (r.top + r.height / 2 - vh / 2) / vh;
          // `translate` property: composes with the CSS `scale` used for hover zooms
          el.style.translate = `0 ${(-p * 26).toFixed(1)}px`;
        }
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Burger / overlay (focus-managed dialog) ---------- */
  const burger = document.getElementById('burger');
  const overlay = document.getElementById('overlay');
  const pageRegions = ['main', 'footer'].map((s) => document.querySelector(s)).filter(Boolean);
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    overlay.classList.toggle('open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('nav-open', open);
    pageRegions.forEach((el) => { el.inert = open; });
    if (open) {
      const first = overlay.querySelector('a');
      if (first) first.focus();
    } else {
      burger.focus();
    }
  };
  if (burger && overlay) {
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    overlay.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) setMenu(false);
    });
  }

  /* ---------- Motion toggle (footer) ---------- */
  const toggle = document.getElementById('motionToggle');
  const applyMotion = () => {
    html.dataset.motion = motionOn ? 'on' : 'off';
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(motionOn));
      toggle.innerHTML = `Motion: <b>${motionOn ? 'on' : 'off'}</b>`;
    }
    if (!motionOn) pxEls.forEach((el) => { el.style.translate = ''; }); // clear stale offsets
    syncSilk();
    onScroll();
  };
  if (toggle) {
    toggle.addEventListener('click', () => {
      motionOn = !motionOn;
      storage.set('ve-motion', motionOn ? 'on' : 'off');
      applyMotion();
    });
    applyMotion();
  }
  // OS-level change wins immediately, mid-session
  motionQuery.addEventListener('change', (e) => {
    motionOn = !e.matches && storage.get('ve-motion') !== 'off';
    applyMotion();
  });
})();
