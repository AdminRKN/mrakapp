/* MRAK8 prototype — core: helpers, store, Telegram adapter (+ emulator), fx */
(function () {
  'use strict';
  const M8 = (window.M8 = {});
  const q = new URLSearchParams(location.search);
  const html = document.documentElement;
  M8.q = q;

  /* ---------------------------------------------------------------- helpers */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  M8.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  M8.raw = (s) => ({ __raw: String(s) });
  M8.h = (strings, ...vals) =>
    strings.reduce((out, s, i) => {
      let v = i < vals.length ? vals[i] : '';
      if (Array.isArray(v)) v = v.map((x) => (x && x.__raw != null ? x.__raw : M8.esc(x))).join('');
      else if (v && v.__raw != null) v = v.__raw;
      else if (v === false || v == null) v = '';
      else v = M8.esc(v);
      return out + s + v;
    }, '');
  M8.el = (markup) => {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
  };
  M8.$ = (s, r = document) => r.querySelector(s);
  M8.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  M8.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  M8.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  M8.raf = () => new Promise((r) => requestAnimationFrame(r));
  M8.price = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  M8.pad = (n, l = 2) => String(n).padStart(l, '0');
  M8.date = (d = new Date()) => `${M8.pad(d.getDate())}.${M8.pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  M8.time = (d = new Date(), sec = true) => `${M8.pad(d.getHours())}:${M8.pad(d.getMinutes())}${sec ? ':' + M8.pad(d.getSeconds()) : ''}`;

  /* reduced motion / weak devices */
  const ua = navigator.userAgent;
  const perfClass = (ua.match(/Telegram-Android\/[\d.]+\s*\([^)]*;\s*(LOW|AVERAGE|HIGH)\)/) || [])[1];
  M8.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || q.get('rm') === '1';
  M8.weak = perfClass === 'LOW' || (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
  if (M8.reduced) html.classList.add('rm');
  if (M8.reduced || M8.weak || q.get('fx') === '0') html.classList.add('no-fx');
  if (q.get('cctv') === '0') html.classList.add('no-cctv');
  // never let a paused timeline (hidden tab) block a purchase flow
  M8.done = (a, ms) => Promise.race([a && a.finished ? a.finished.catch(() => {}) : Promise.resolve(), M8.wait(ms)]);
  M8.anim = (el, kf, opts) => {
    if (!el) return { finished: Promise.resolve(), cancel() {} };
    if (M8.reduced) {
      const last = Array.isArray(kf) ? kf[kf.length - 1] : null;
      if (last && opts && opts.fill && opts.fill !== 'none') Object.assign(el.style, last);
      return { finished: Promise.resolve(), cancel() {} };
    }
    return el.animate(kf, opts);
  };

  /* SUBJECT number from telegram user id (same function will live on the server) */
  M8.subjectNo = (id) => {
    let h = 0x811c9dc5;
    for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return '08-' + M8.pad(h % 10000, 4);
  };

  /* ------------------------------------------------------------------ store */
  const subs = new Set();
  M8.state = {
    cart: [],           // {id, size, qty}
    height: null,       // remembered subject height, cm
    orders: [],
    watch: {},          // drop notifications
    view: 'feed',       // feed | files
    filter: 'all',
    visits: 0,
  };
  M8.set = (patch) => {
    Object.assign(M8.state, typeof patch === 'function' ? patch(M8.state) : patch);
    subs.forEach((f) => f(M8.state));
    M8.persist();
  };
  M8.on = (fn) => (subs.add(fn), () => subs.delete(fn));

  /* ------------------------------------------------------- Telegram adapter */
  const W = window.Telegram && window.Telegram.WebApp;
  const inTG = !!(W && W.initData);
  const frame = q.get('frame') === '1';
  M8.inTG = inTG;
  M8.frame = frame;
  if (!inTG) html.classList.add('emu');
  if (frame) html.classList.add('frame');
  if (!inTG && !frame && innerWidth > 640) document.addEventListener('DOMContentLoaded', () => document.body.classList.add('is-wide'));

  const atLeast = (v) => (inTG ? W.isVersionAtLeast(v) : true);
  const demoUser = { id: 518447001, first_name: 'Субъект', last_name: 'Восемь', username: 'subject_0x8', photo_url: '', language_code: 'ru' };
  const user = (inTG && W.initDataUnsafe && W.initDataUnsafe.user) || demoUser;
  M8.user = user;
  M8.subject = M8.subjectNo(user.id);
  M8.startParam = (inTG && W.initDataUnsafe && W.initDataUnsafe.start_param) || q.get('startapp') || q.get('tgWebAppStartParam') || '';

  if (!inTG) {
    const st = html.style;
    st.setProperty('--tg-safe-area-inset-top', frame ? '47px' : 'env(safe-area-inset-top, 0px)');
    st.setProperty('--tg-safe-area-inset-bottom', frame ? '34px' : 'env(safe-area-inset-bottom, 0px)');
    st.setProperty('--tg-content-safe-area-inset-top', '46px');
  }

  M8.tgInit = () => {
    if (!inTG) return;
    try {
      W.ready();
      W.expand();
      const mobile = ['ios', 'android', 'android_x'].includes(W.platform);
      if (mobile && atLeast('8.0')) W.requestFullscreen();
      if (atLeast('7.7')) W.disableVerticalSwipes();
      if (atLeast('6.1')) { W.setHeaderColor('#0B0B0B'); W.setBackgroundColor('#0B0B0B'); }
      if (atLeast('7.10')) W.setBottomBarColor('#0B0B0B');
    } catch (e) { console.warn('[tg] init', e); }
  };

  /* haptics */
  const emuHaptic = (kind) => {
    if (frame) parent.postMessage({ m8: 'haptic', kind }, '*');
    else if (navigator.vibrate) { try { navigator.vibrate(kind.includes('heavy') ? 22 : kind.startsWith('notify') ? [10, 40, 14] : 6); } catch (e) {} }
  };
  M8.haptic = {
    impact(style = 'light') { inTG && atLeast('6.1') ? W.HapticFeedback.impactOccurred(style) : emuHaptic('impactOccurred(' + style + ')'); },
    notify(type = 'success') { inTG && atLeast('6.1') ? W.HapticFeedback.notificationOccurred(type) : emuHaptic('notificationOccurred(' + type + ')'); },
    select() { inTG && atLeast('6.1') ? W.HapticFeedback.selectionChanged() : emuHaptic('selectionChanged()'); },
  };

  /* CloudStorage with localStorage fallback */
  M8.cloud = {
    get(key) {
      if (inTG && atLeast('6.9')) return new Promise((res) => W.CloudStorage.getItem(key, (err, v) => res(err ? null : v)));
      try { return Promise.resolve(localStorage.getItem('m8:' + key)); } catch (e) { return Promise.resolve(null); }
    },
    set(key, val) {
      if (inTG && atLeast('6.9')) return new Promise((res) => W.CloudStorage.setItem(key, val, () => res()));
      try { localStorage.setItem('m8:' + key, val); } catch (e) {}
      return Promise.resolve();
    },
  };
  let persistT = 0;
  M8.persist = () => {
    clearTimeout(persistT);
    persistT = setTimeout(() => {
      const s = M8.state;
      M8.cloud.set('cart', JSON.stringify(s.cart));
      M8.cloud.set('profile', JSON.stringify({ height: s.height, view: s.view, visits: s.visits, watch: s.watch }));
      M8.cloud.set('orders', JSON.stringify(s.orders.slice(0, 20)));
    }, 250);
  };
  M8.restore = async () => {
    if (q.get('fresh') === '1') return;
    const [cart, profile, orders] = await Promise.all([M8.cloud.get('cart'), M8.cloud.get('profile'), M8.cloud.get('orders')]);
    try { if (cart) M8.state.cart = JSON.parse(cart); } catch (e) {}
    try { if (profile) Object.assign(M8.state, JSON.parse(profile)); } catch (e) {}
    try { if (orders) M8.state.orders = JSON.parse(orders); } catch (e) {}
  };

  /* bottom buttons: native in Telegram, emulated DOM elsewhere */
  const btnState = {
    main: { text: '', color: '#E0241B', textColor: '#FFFFFF', visible: false, active: true, progress: false, shine: false, fn: null },
    sec: { text: '', color: '#1C1C1C', textColor: '#F1ECE1', visible: false, active: true, position: 'left', fn: null },
  };
  let bottomEl = null;
  const renderEmuBottom = () => {
    if (inTG) return;
    if (!bottomEl) bottomEl = document.querySelector('.tg-bottom');
    if (!bottomEl) return;
    const m = btnState.main, s = btnState.sec;
    const mb = bottomEl.querySelector('.tg-btn--main'), sb = bottomEl.querySelector('.tg-btn--sec');
    mb.hidden = !m.visible; sb.hidden = !s.visible;
    mb.style.background = m.color; mb.style.color = m.textColor;
    mb.classList.toggle('is-off', !m.active);
    mb.classList.toggle('is-shine', !!m.shine && m.active && !m.progress);
    mb.innerHTML = m.progress ? '<i class="spin"></i>' : M8.esc(m.text);
    sb.style.background = s.color; sb.style.color = s.textColor; sb.textContent = s.text;
    sb.style.order = s.position === 'right' ? 2 : 0;
    const on = m.visible || s.visible;
    bottomEl.classList.toggle('is-on', on);
    html.style.setProperty('--tab-safe', on ? '0px' : 'var(--safe-bottom)');
  };
  const nativeMain = () => {
    const m = btnState.main;
    W.MainButton.setParams({ text: m.text || ' ', color: m.color, text_color: m.textColor, is_active: m.active, is_visible: m.visible, has_shine_effect: !!m.shine });
    if (m.progress) W.MainButton.showProgress(false); else W.MainButton.hideProgress();
  };
  const nativeSec = () => {
    if (!atLeast('7.10')) return;
    const s = btnState.sec;
    W.SecondaryButton.setParams({ text: s.text || ' ', color: s.color, text_color: s.textColor, is_active: s.active, is_visible: s.visible, position: s.position });
  };
  const mainClick = () => { const m = btnState.main; if (m.fn && m.active && !m.progress) m.fn(); };
  const secClick = () => { const s = btnState.sec; if (s.fn && s.active) s.fn(); };
  if (inTG) {
    W.MainButton.onClick(mainClick);
    if (atLeast('7.10')) W.SecondaryButton.onClick(secClick);
  } else {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.tg-btn--main')) mainClick();
      else if (e.target.closest('.tg-btn--sec')) secClick();
    });
  }
  M8.main = (p) => { Object.assign(btnState.main, p); inTG ? nativeMain() : renderEmuBottom(); };
  M8.secondary = (p) => { Object.assign(btnState.sec, p); inTG ? nativeSec() : renderEmuBottom(); };
  M8.mainState = () => btnState.main;

  let backFn = null;
  M8.back = (fn) => {
    backFn = fn || null;
    if (inTG) { fn ? W.BackButton.show() : W.BackButton.hide(); }
    else {
      const pill = document.querySelector('.tg-pill--l');
      if (pill) pill.innerHTML = fn
        ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 3 5 8l5 5"/></svg>Назад'
        : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>Закрыть';
    }
  };
  if (inTG) W.BackButton.onClick(() => backFn && backFn());
  else document.addEventListener('click', (e) => { if (e.target.closest('.tg-pill--l') && backFn) backFn(); });

  /* payments, contact, sharing */
  // prototype has no backend yet: a '$demo' link always goes to the emulated sheet, even inside Telegram
  M8.openInvoice = (url, cb) => (inTG && url && !url.includes('$demo') ? W.openInvoice(url, cb) : M8.emuInvoice(cb));
  M8.requestContact = () =>
    new Promise((res) => {
      if (inTG && atLeast('6.9')) {
        W.requestContact((ok, r) => res(ok && r && r.responseUnsafe && r.responseUnsafe.contact ? '+' + String(r.responseUnsafe.contact.phone_number).replace(/^\+/, '') : null));
      } else setTimeout(() => res('+7 999 008-08-08'), 380);
    });
  M8.device = { tilt: null };
  M8.startOrientation = (cb) => {
    if (inTG && atLeast('8.0') && W.DeviceOrientation) {
      try {
        W.DeviceOrientation.start({ refresh_rate: 50 });
        const h = () => cb(W.DeviceOrientation.beta || 0, W.DeviceOrientation.gamma || 0, true);
        W.onEvent('deviceOrientationChanged', h);
        return () => { W.offEvent('deviceOrientationChanged', h); W.DeviceOrientation.stop(); };
      } catch (e) {}
    }
    const h = (e) => e.gamma != null && cb((e.beta || 0) * Math.PI / 180, (e.gamma || 0) * Math.PI / 180, false);
    addEventListener('deviceorientation', h);
    return () => removeEventListener('deviceorientation', h);
  };

  /* ---------------------------------------------------------------- texture */
  M8.grain = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const url = c.toDataURL('image/png');
    html.style.setProperty('--grain', `url(${url})`);
    return url;
  })();

  /* clock: everything with [data-clock] ticks */
  M8.tick = () => {
    const d = new Date();
    const t = M8.time(d), dt = M8.date(d);
    M8.$$('[data-clock]').forEach((el) => {
      const f = el.dataset.clock;
      el.textContent = f === 'full' ? `${dt} ${t}` : f === 'tc' ? `${t}:${M8.pad(Math.floor(d.getMilliseconds() / 40), 2)}` : t;
    });
  };
  setInterval(M8.tick, 1000);

  /* ------------------------------------------------------------------- logo */
  const L = window.MRAK_LOGO;
  const VB = L.viewBox.join(' ');
  M8.logo = (cls = '') =>
    `<svg class="${cls}" viewBox="${VB}" fill="currentColor" aria-label="MRAK8" role="img"><path d="${L.letters.m}${L.letters.r}${L.letters.a}${L.letters.k}" fill-rule="evenodd"/><path d="${L.ringTop}" fill-rule="evenodd"/><path d="${L.ringBottom}" fill-rule="evenodd"/></svg>`;
  // layered logo: each letter and each ring is its own <svg> box -> real CSS 3D on the rings
  M8.logoLayers = () => {
    const box = (inner, cls, origin) => `<svg class="${cls}" viewBox="${VB}" fill="currentColor" aria-hidden="true" style="transform-origin:${origin}">${inner}</svg>`;
    const pct = (e) => `${(((e[0] - L.viewBox[0]) / L.viewBox[2]) * 100).toFixed(2)}% ${(((e[1] - L.viewBox[1]) / L.viewBox[3]) * 100).toFixed(2)}%`;
    return (
      `<div class="logo3d" role="img" aria-label="MRAK8">` +
      box(`<path d="${L.ringBottom}" fill-rule="evenodd"/>`, 'ring ring--b', pct(L.ringBottomEllipse)) +
      box(`<path d="${L.ringTop}" fill-rule="evenodd"/>`, 'ring ring--t', pct(L.ringTopEllipse)) +
      ['m', 'r', 'a', 'k'].map((k) => box(`<path d="${L.letters[k]}" fill-rule="evenodd"/>`, 'l-letter l-' + k, '50% 100%')).join('') +
      `</div>`
    );
  };
  // the 8 on its own (loader / pull-to-refresh / scanner)
  M8.eight = (cls = '') => {
    const t = L.ringTopEllipse, b = L.ringBottomEllipse;
    const x0 = b[0] - b[2] - 2, y0 = t[1] - t[3] - 2, w = b[2] * 2 + 4, h = b[1] + b[3] - y0 + 2;
    const vb = `${x0} ${y0} ${w} ${h}`;
    const o = (e) => `${(((e[0] - x0) / w) * 100).toFixed(2)}% ${(((e[1] - y0) / h) * 100).toFixed(2)}%`;
    return `<div class="eight ${cls}" aria-hidden="true" style="position:relative;aspect-ratio:${(w / h).toFixed(3)};perspective:400px">
      <svg viewBox="${vb}" fill="currentColor" style="position:absolute;inset:0;width:100%;height:100%;transform-origin:${o(b)}" class="ring ring--b"><path d="${L.ringBottom}" fill-rule="evenodd"/></svg>
      <svg viewBox="${vb}" fill="currentColor" style="position:absolute;inset:0;width:100%;height:100%;transform-origin:${o(t)}" class="ring ring--t"><path d="${L.ringTop}" fill-rule="evenodd"/></svg>
    </div>`;
  };
  M8.spinEight = (root, speed = 1) => {
    const t = root.querySelector('.ring--t'), b = root.querySelector('.ring--b');
    const a1 = M8.anim(t, [{ transform: 'rotateY(0deg) rotateX(0deg)' }, { transform: 'rotateY(360deg) rotateX(20deg)' }, { transform: 'rotateY(720deg) rotateX(0deg)' }], { duration: 1600 / speed, iterations: Infinity, easing: 'linear' });
    const a2 = M8.anim(b, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(360deg)' }], { duration: 1150 / speed, iterations: Infinity, easing: 'linear' });
    return () => { a1.cancel(); a2.cancel(); };
  };

  /* height chart (mugshot wall). opts: {from, to, step, labelEvery, w, h} -> svg */
  M8.hchart = ({ from = 150, to = 200, minor = 1, major = 5, label = 10, left = true, color = 'currentColor', w = 100, h = 100, strong = 0.42, weak = 0.14 } = {}) => {
    const n = to - from;
    let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">`;
    for (let v = from; v <= to; v += minor) {
      const y = (h * (to - v)) / n;
      const isMaj = (v - from) % major === 0, isLab = (v - from) % label === 0;
      const len = isLab ? w : isMaj ? w * 0.18 : w * 0.06;
      const x0 = left ? 0 : w - len;
      s += `<line x1="${x0}" x2="${x0 + len}" y1="${y}" y2="${y}" stroke="${color}" stroke-opacity="${isLab ? strong : isMaj ? strong * 0.8 : weak}" vector-effect="non-scaling-stroke" stroke-width="1"/>`;
    }
    return s + '</svg>';
  };

  /* ------------------------------------------------------------------ stamp */
  let stampSeed = 3;
  M8.stampSVG = (text, sub = '', { w = 320, h = 104, color = 'currentColor', double = true } = {}) => {
    const id = 'ink' + stampSeed++;
    const fs = h * 0.56;
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><filter id="${id}" x="-5%" y="-10%" width="110%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${stampSeed}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 0 0 0 1.95" result="m"/>
      <feComposite in="SourceGraphic" in2="m" operator="in" result="k"/>
      <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="${stampSeed + 9}" result="w"/>
      <feDisplacementMap in="k" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
      <g filter="url(#${id})" fill="none" stroke="${color}">
        <rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="5" stroke-width="5"/>
        ${double ? `<rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="2" stroke-width="2"/>` : ''}
        <text x="${w / 2}" y="${sub ? h * 0.6 : h * 0.68}" text-anchor="middle" fill="${color}" stroke="none" font-family="Roboto Condensed, Arial Narrow, sans-serif" font-weight="900" font-size="${sub ? fs * 0.9 : fs}" letter-spacing="2" textLength="${w - 56}" lengthAdjust="spacingAndGlyphs">${M8.esc(text)}</text>
        ${sub ? `<text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" fill="${color}" stroke="none" font-family="JetBrains Mono, monospace" font-weight="700" font-size="${h * 0.11}" letter-spacing="1.5">${M8.esc(sub)}</text>` : ''}
      </g></svg>`;
  };
  // slam a stamp into a container. returns the stamp element
  M8.slam = async (host, text, { sub = '', rot = -9, cls = '', haptic = 'heavy', shakeEl = null, delay = 0, w, h } = {}) => {
    const st = M8.el(`<div class="stamp ${cls}">${M8.stampSVG(text, sub, { w, h })}</div>`);
    st.style.opacity = '0';
    host.appendChild(st);
    if (delay) await M8.wait(delay);
    st.style.opacity = '';
    const r = `rotate(${rot}deg)`;
    const a = M8.anim(st, [
      { transform: `scale(1.45) ${r} rotate(-4deg)`, opacity: 0, filter: 'blur(3px)' },
      { transform: `scale(1.08) ${r}`, opacity: 1, filter: 'blur(0px)', offset: 0.62 },
      { transform: `scale(.98) ${r}`, offset: 0.82 },
      { transform: `scale(1) ${r}` },
    ], { duration: 300, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
    setTimeout(() => {
      if (haptic) haptic === 'success' ? M8.haptic.notify('success') : M8.haptic.impact(haptic);
      M8.shake(shakeEl || document.querySelector('.app'));
    }, M8.reduced ? 0 : 190);
    await M8.done(a, 420);
    st.style.transform = r;
    return st;
  };
  M8.shake = (el, px = 4) => {
    if (!el) return;
    M8.anim(el, [
      { transform: 'translate(0,0)' }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: `translate(${px}px,${-px / 2}px)` },
      { transform: `translate(${-px / 2}px,${px / 3}px)` }, { transform: 'translate(0,0)' },
    ], { duration: 80, easing: 'linear' });
  };

  /* scramble text into a new value (terminal feel) */
  M8.scramble = (el, text, dur = 260) => {
    if (!el) return;
    if (M8.reduced) { el.textContent = text; return; }
    const chars = '0123456789#/<>_-=+';
    const start = performance.now();
    const from = el.textContent;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      let out = '';
      for (let i = 0; i < text.length; i++) out += i < Math.floor(p * text.length) ? text[i] : (text[i] === ' ' ? ' ' : chars[(Math.random() * chars.length) | 0]);
      el.textContent = p < 1 ? out : text;
      if (p < 1) requestAnimationFrame(step);
    };
    if (from !== text) requestAnimationFrame(step);
  };

  /* type lines into an element, char by char */
  M8.type = async (el, markup, cps = 70) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = markup;
    const full = tmp.textContent;
    if (M8.reduced) { el.innerHTML = markup; return; }
    el.classList.add('cur');
    for (let i = 1; i <= full.length; i++) {
      el.textContent = full.slice(0, i);
      await M8.wait(1000 / cps);
    }
    el.innerHTML = markup;
    el.classList.remove('cur');
  };

  /* camera switch between tabs */
  M8.camcut = (label) => {
    if (M8.reduced) return;
    let c = document.querySelector('.camcut');
    if (!c) { c = M8.el('<div class="camcut"><span class="camcut__label"></span></div>'); document.body.appendChild(c); }
    c.querySelector('.camcut__label').textContent = label;
    M8.anim(c, [{ opacity: 0 }, { opacity: 0.92, offset: 0.25 }, { opacity: 0.6, offset: 0.6 }, { opacity: 0 }], { duration: 260, easing: 'steps(5)' });
  };

  /* toast */
  M8.toast = (msg, { action, onAction, ms = 2600 } = {}) => {
    let host = document.querySelector('.toasts');
    if (!host) { host = M8.el('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(host); }
    const t = M8.el(`<div class="toast"><span>${M8.esc(msg)}</span>${action ? `<button type="button">${M8.esc(action)}</button>` : ''}</div>`);
    host.appendChild(t);
    M8.anim(t, [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    let done = false;
    const close = () => {
      if (done) return; done = true;
      M8.anim(t, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 180, fill: 'forwards' }).finished.then(() => t.remove());
    };
    if (action) t.querySelector('button').onclick = () => { onAction && onAction(); close(); };
    setTimeout(close, ms);
    return close;
  };

  /* fly an image into the evidence-bag tab */
  M8.flyToBag = async (fromEl, src) => {
    const target = document.querySelector('[data-tab="bag"] .tab__bag');
    if (!fromEl || !target) return;
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    const size = Math.min(a.width, a.height);
    const outer = M8.el(`<div style="position:fixed;left:${a.left + (a.width - size) / 2}px;top:${a.top + (a.height - size) / 2}px;width:${size}px;height:${size}px;z-index:84;pointer-events:none"></div>`);
    const inner = M8.el(`<div style="width:100%;height:100%"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(0,0,0,.6))"></div>`);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = 18 / size;
    const d = 640;
    const ax = M8.anim(outer, [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration: d, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
    M8.anim(inner, [
      { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translateY(${-60}px) scale(.55) rotate(-8deg)`, opacity: 1, offset: 0.3 },
      { transform: `translateY(${dy}px) scale(${s}) rotate(12deg)`, opacity: 0.85 },
    ], { duration: d, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    await M8.done(ax, d + 160);
    outer.remove();
    M8.haptic.impact('light');
    const tab = target.closest('.tab');
    M8.anim(target, [{ transform: 'scale(1)' }, { transform: 'scale(1.45) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    if (tab) M8.anim(tab, [{ background: 'rgba(224,36,27,.18)' }, { background: 'transparent' }], { duration: 500 });
  };

  /* hand-drawn marker strike (cart delete) and signature scribble */
  M8.strikePath = (w) => {
    let d = `M -4 ${11 + Math.random() * 2}`;
    const n = 4;
    for (let i = 1; i <= n; i++) d += ` Q ${(w * (i - 0.5)) / n} ${8 + Math.random() * 6} ${(w * i) / n + (i === n ? 6 : 0)} ${9 + Math.random() * 4}`;
    return d;
  };
  M8.signPath = (seed, w = 220, h = 60) => {
    let s = 0;
    for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    let x = 10, y = h * 0.62;
    let d = `M ${x} ${y}`;
    const loops = 5 + (s % 3);
    for (let i = 0; i < loops; i++) {
      const up = h * (0.12 + rnd() * 0.3), dx = (w - 60) / loops;
      d += ` C ${x + dx * 0.2} ${y - up * 1.6} ${x + dx * 0.9} ${y - up * 1.2} ${x + dx * 0.55} ${y + 4}`;
      x += dx; d += ` S ${x + dx * 0.1} ${y - up * 0.2} ${x} ${y}`;
    }
    d += ` C ${x + 14} ${y + 10} ${x - 70} ${y + 14} ${x - 120} ${y + 6}`;
    return d;
  };

  /* --------------------------------------------------- QR (byte mode, ECC M) */
  M8.qr = (text, { quiet = 2 } = {}) => {
    const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
    const BLK = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
    const bytes = Array.from(new TextEncoder().encode(text));
    const rawMods = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; };
    const dataCap = (v) => Math.floor(rawMods(v) / 8) - ECC[v] * BLK[v];
    let ver = 1;
    for (; ver <= 10; ver++) if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCap(ver) * 8) break;
    if (ver > 10) throw new Error('qr: too long');
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
    const capBits = dataCap(ver) * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
    const divisor = (deg) => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; };
    const remainder = (dat, div) => { const r = div.map(() => 0); for (const b of dat) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => (r[i] ^= mul(c, f))); } return r; };
    const nb = BLK[ver], el = ECC[ver], raw = Math.floor(rawMods(ver) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    const div = divisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = remainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc));
    }
    const cw = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const align = (() => { if (ver === 1) return []; const na = Math.floor(ver / 7) + 2; const step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2; const r = [6]; for (let p = size - 7; r.length < na; p -= step) r.splice(1, 0, p); return r; })();
    align.forEach((ax, i) => align.forEach((ay, j) => { if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const fmt = (mask) => {
      const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412, g = (i) => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) setF(8, i, g(i));
      setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, g(i));
      setF(8, size - 8, true);
    };
    fmt(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const c = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), bb = Math.floor(i / 3); setF(a, bb, c); setF(bb, a, c); } }
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < cw.length * 8) { mod[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalty = () => {
      let p = 0;
      const lines = (get) => {
        for (let a = 0; a < size; a++) {
          let run = 1;
          for (let b = 1; b <= size; b++) {
            if (b < size && get(a, b) === get(a, b - 1)) run++;
            else { if (run >= 5) p += 3 + (run - 5); run = 1; }
          }
          for (let b = 0; b + 6 < size; b++) {
            const s = [1, 0, 1, 1, 1, 0, 1].every((v, i) => get(a, b + i) === !!v);
            if (s) p += 40;
          }
        }
      };
      lines((a, b) => mod[a][b]); lines((a, b) => mod[b][a]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
      let dark = 0; mod.forEach((r) => r.forEach((c) => (dark += c ? 1 : 0)));
      p += (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { applyMask(m); fmt(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
    applyMask(best); fmt(best);
    const n = size + quiet * 2;
    let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-label="QR"><rect width="${n}" height="${n}" fill="#F6F3EC"/><path d="${d}" fill="#0B0B0B"/></svg>`;
  };
})();
