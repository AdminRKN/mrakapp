/* MRAK8 prototype — shell, router, screens */
(function () {
  'use strict';
  const { h, raw, el, $, $$ } = M8;
  const S = () => M8.state;
  const screens = {};
  M8.screens = screens;

  /* ================================================================ shell */
  const ICON = {
    bag: '<svg class="tab__bag" viewBox="0 0 18 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 5h15v12.6c0 .7-.5 1.2-1.2 1.2H2.7c-.7 0-1.2-.5-1.2-1.2z"/><path d="M1.5 1.6h15V5h-15z" fill="currentColor" fill-opacity=".22"/><path d="M4.5 10h6M4.5 13h8.5" stroke-opacity=".6"/></svg>',
    feed: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="1.5" width="12" height="15"/><path d="M6 13h6"/></svg>',
    files: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 3.5h15M1.5 9h15M1.5 14.5h15"/><path d="M4 2v3M4 7.5v3M4 13v3" stroke-width="2"/></svg>',
    signal: '<svg viewBox="0 0 66 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx=".6"/><rect x="5" y="6" width="3" height="6" rx=".6"/><rect x="10" y="3" width="3" height="9" rx=".6"/><rect x="15" y="0" width="3" height="12" rx=".6"/><path d="M30 3.2a9.6 9.6 0 0 1 13 0l-1.4 1.5a7.5 7.5 0 0 0-10.2 0zm2.6 2.8a5.7 5.7 0 0 1 7.8 0L39 7.5a3.6 3.6 0 0 0-5 0zm2.6 2.8a1.9 1.9 0 0 1 2.6 0L36.5 10.4z"/><rect x="48.5" y=".5" width="15" height="11" rx="3" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="50" y="2" width="10" height="8" rx="1.6"/><rect x="64.5" y="4" width="1.4" height="4" rx=".6" fill-opacity=".5"/></svg>',
  };

  function buildShell(root) {
    root.innerHTML = h`
      <div class="app">
        <header class="hdr">
          <button class="hdr__logo" data-go="#/" aria-label="MRAK8 — к вещдокам">${raw(M8.logo())}</button>
          <button class="hdr__subject" data-go="#/dossier" aria-label="Ваше дело"><span>SUBJECT</span><b>#${M8.subject}</b></button>
          <div class="hdr__rec" aria-hidden="true"><span class="rec"><i class="dot"></i>REC · CAM_08</span><time data-clock="full"></time></div>
        </header>
        <main class="stage" id="stage"></main>
        <nav class="tabbar" aria-label="Разделы">
          <button class="tab" data-tab="catalog" data-go="#/"><i>01</i>ВЕЩДОКИ</button>
          <button class="tab" data-tab="bag" data-go="#/bag"><span class="tab__row">${raw(ICON.bag)}<b class="tab__count" data-n="0">0</b></span>ПАКЕТ</button>
          <button class="tab" data-tab="dossier" data-go="#/dossier"><i>03</i>ДОСЬЕ</button>
        </nav>
      </div>
      <div class="tg-bottom" aria-label="Кнопки Telegram (эмуляция)">
        <button class="tg-btn tg-btn--sec" type="button" hidden></button>
        <button class="tg-btn tg-btn--main" type="button" hidden></button>
      </div>`;
    // overlays live on <body>: the CCTV layer covers the splash too; emulated Telegram chrome sits above everything, like the native one
    document.body.insertAdjacentHTML('beforeend', h`
      <div class="cctv" aria-hidden="true"><div class="cctv__lines"></div><div class="cctv__grain"></div><div class="cctv__roll"></div><div class="cctv__vig"></div></div>
      <div class="tg-status" aria-hidden="true"><span>9:41</span>${raw(ICON.signal)}</div>
      <div class="tg-pills"><button class="tg-pill tg-pill--l" type="button"></button><span class="tg-pill tg-pill--r" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="m4 6 4 4 4-4"/></svg><svg viewBox="0 0 16 16" fill="#fff"><circle cx="3" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/></svg></span></div>`);
    M8.back(null);
    M8.tick();
    root.addEventListener('click', (e) => {
      const g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); M8.haptic.impact('light'); go(g.dataset.go); }
    });
    M8.on(updateCount);
    updateCount();
  }
  let lastCount = -1;
  function updateCount() {
    const n = S().cart.reduce((a, c) => a + c.qty, 0);
    const c = $('.tab__count');
    if (!c || n === lastCount) return;
    c.dataset.n = n;
    if (lastCount >= 0) M8.scramble(c, String(n), 220); else c.textContent = n;
    lastCount = n;
  }

  /* =============================================================== router */
  const stack = [];
  let cur = null; // {path, def, el, cleanup}
  const parse = (path) => {
    const p = (path || '#/').replace(/^#/, '').split('/').filter(Boolean);
    if (!p.length) return { name: 'catalog', params: {} };
    if (p[0] === 'case') return { name: 'case', params: { id: p[1] || '001' } };
    if (p[0] === 'booked') return { name: 'booked', params: { no: p[1] } };
    if (p[0] === 'admin') return p[1] === 'p' ? { name: 'editor', params: { id: p[2] } } : { name: 'admin', params: { tab: p[1] || 'products' } };
    return { name: screens[p[0]] ? p[0] : 'catalog', params: {} };
  };
  function go(path, { back = false, replace = false } = {}) {
    if (cur && cur.path === path) return;
    const { name, params } = parse(path);
    const def = screens[name];
    const prevDef = cur && cur.def;
    const tabSwitch = !back && def.root && prevDef && prevDef.root && def.tab !== prevDef.tab;
    if (back) stack.pop(); else if (replace || def.root) { stack.length = 0; stack.push(path); } else stack.push(path);
    const swap = () => {
      if (cur) {
        if (cur.cleanup) try { cur.cleanup(); } catch (e) { console.error(e); }
        if (cur.def.keep) { cur.el.hidden = true; } else cur.el.remove();
      }
      M8.main({ visible: false, shine: false, progress: false, active: true, fn: null, color: '#E0241B', textColor: '#FFFFFF' });
      M8.secondary({ visible: false, fn: null });
      let elx = def.keep && def._el;
      if (!elx) {
        elx = def.render(params);
        $('#stage').appendChild(elx);
        if (def.keep) def._el = elx;
      } else elx.hidden = false;
      cur = { path, def, el: elx, cleanup: null };
      cur.cleanup = def.mount ? def.mount(elx, params, { back }) : null;
      $$('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.tab === def.tab));
      const canBack = stack.length > 1 || !!def.parent;
      M8.back(canBack ? () => goBack() : null);
      try { history.replaceState(null, '', path); } catch (e) {}
      if (M8.frame) parent.postMessage({ m8: 'route', path, name }, '*');
    };
    const vtOK = document.startViewTransition && !M8.reduced && cur && !tabSwitch;
    if (tabSwitch) { M8.camcut('CAM_0' + ({ catalog: 1, bag: 2, dossier: 3 }[def.tab] || 8) + ' · ' + (def.camLabel || '')); swap(); return; }
    if (vtOK) {
      html.classList.toggle('vt-back', !!back);
      if (prevDef && prevDef.beforeLeave) prevDef.beforeLeave(cur.el, { to: name, params });
      const t = document.startViewTransition(() => { swap(); if (def.afterEnter) def.afterEnter(cur.el, params, { back }); });
      t.finished.finally(() => { html.classList.remove('vt-back'); $$('#stage [style*="view-transition-name"]').forEach((n) => (n.style.viewTransitionName = '')); });
    } else {
      swap();
      if (def.afterEnter) def.afterEnter(cur.el, params, { back });
      if (prevDef) M8.anim(cur.el, [{ opacity: 0, transform: `translateX(${back ? -6 : 8}%)` }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }
  const html = document.documentElement;
  function goBack() {
    if (stack.length > 1) go(stack[stack.length - 2], { back: true });
    else go((cur && cur.def.parent) || '#/', { back: true, replace: true });
  }
  M8.go = go;
  M8.goBack = goBack;

  /* ============================================================== helpers */
  const cartTotal = () => S().cart.reduce((a, c) => a + M8.product(c.id).price * c.qty, 0);
  const cartCount = () => S().cart.reduce((a, c) => a + c.qty, 0);
  const sizeOf = (p, s) => p.sizes.find((x) => x.s === s);
  const stockTag = (p) => {
    if (p.status === 'soldout') return '<span class="tag tag--warn">SOLD OUT</span>';
    if (p.status === 'drop') return '<span class="tag tag--warn">ДРОП СКОРО</span>';
    const n = M8.stockOf(p);
    return n <= 5 ? `<span class="tag tag--warn">ОСТАЛОСЬ ${n}</span>` : '<span class="tag tag--ok">В НАЛИЧИИ</span>';
  };
  const countdown = (t) => {
    const d = Math.max(0, t - Date.now());
    const D = Math.floor(d / 864e5), H = Math.floor((d % 864e5) / 36e5), Mi = Math.floor((d % 36e5) / 6e4), Se = Math.floor((d % 6e4) / 1e3);
    return { D: M8.pad(D), H: M8.pad(H), M: M8.pad(Mi), S: M8.pad(Se) };
  };
  const countHTML = (t) => { const c = countdown(t); return `<div class="count" data-count="${t}"><span>${c.D}<small>ДН</small></span><b class="sep">:</b><span>${c.H}<small>ЧАС</small></span><b class="sep">:</b><span>${c.M}<small>МИН</small></span><b class="sep">:</b><span>${c.S}<small>СЕК</small></span></div>`; };
  setInterval(() => $$('[data-count]').forEach((n) => { const c = countdown(+n.dataset.count); const s = n.querySelectorAll('span'); [c.D, c.H, c.M, c.S].forEach((v, i) => { if (s[i] && s[i].firstChild.nodeValue !== v) s[i].firstChild.nodeValue = v; }); }), 1000);
  const tape = (text, cls = '', speed = 22) => {
    const t = M8.esc(text);
    const run = Array(6).fill(`<span>${t}</span>`).join('');
    return `<div class="tape ${cls}" aria-hidden="true" style="--tape-speed:${speed}s"><div class="tape__track">${run}${run}</div></div>`;
  };
  M8.tape = tape;
  const SLOGAN = 'NO EMOTIONAL CONTRABAND. ALL SUBJECTS ARE MONITORED. НЕ ДИЗАЙНЕР.';
  const silhouette = '<svg viewBox="0 0 100 120" aria-hidden="true"><path d="M50 14c-14 0-22 11-22 25 0 10 4 18 10 22l-1 8C21 73 9 81 6 96v24h88V96c-3-15-15-23-31-27l-1-8c6-4 10-12 10-22 0-14-8-25-22-25z" fill="#4a4743"/></svg>';
  const chartLabels = (from, to, step, cls = '') => {
    let s = '';
    for (let v = from; v <= to; v += step) s += `<span class="${cls}" style="position:absolute;left:4px;top:${((to - v) / (to - from)) * 100}%;transform:translateY(-120%);font:600 8px/1 var(--font-mono);letter-spacing:.06em;color:var(--mrak-grey)">${v}</span>`;
    return s;
  };

  /* ============================================================= CATALOG */
  screens.catalog = {
    root: true, keep: true, tab: 'catalog', camLabel: 'EVIDENCE',
    render() {
      const e = el(`<section class="screen cat" aria-label="Каталог вещдоков">
        <div class="cat__bar">
          <div class="chips" role="tablist" aria-label="Фильтр">${M8.CATS.map((c) => `<button class="chip" role="tab" data-f="${c.k}">${c.t}</button>`).join('')}</div>
          <div class="viewtog" role="group" aria-label="Вид"><button data-v="feed" aria-label="Лента">${ICON.feed}</button><button data-v="files" aria-label="Картотека">${ICON.files}</button></div>
        </div>
        <div class="cat__body" style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"></div>
      </section>`);
      e.style.display = 'flex';
      return e;
    },
    mount(e) {
      const body = $('.cat__body', e);
      const list = () => M8.products.filter((p) => {
        const f = S().filter;
        if (f === 'all') return true;
        if (f === 'archive') return p.status === 'soldout' || p.status === 'archive';
        return p.cat === f && p.status !== 'archive';
      });
      if (!e._init) {
        e._init = true;
        e._draw = (anim) => {
          if (e._offFeed) { e._offFeed(); e._offFeed = null; }
          $$('.chip', e).forEach((c) => c.classList.toggle('is-on', c.dataset.f === S().filter));
          $$('.viewtog button', e).forEach((b) => b.classList.toggle('is-on', b.dataset.v === S().view));
          const items = list();
          body.innerHTML = S().view === 'files' ? filesHTML(items) : feedHTML(items);
          if (S().view === 'feed') e._offFeed = wireFeed(body);
          if (anim) M8.anim(body, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
        };
        e.addEventListener('click', (ev) => {
          const chip = ev.target.closest('.chip');
          if (chip) { if (chip.dataset.f !== S().filter) { M8.haptic.select(); M8.set({ filter: chip.dataset.f }); e._draw(true); } return; }
          const v = ev.target.closest('[data-v]');
          if (v) { if (v.dataset.v !== S().view) { M8.haptic.select(); M8.set({ view: v.dataset.v }); e._draw(true); } return; }
          const w = ev.target.closest('[data-watch]');
          if (w) { ev.stopPropagation(); watchDrop(w.dataset.watch, w); return; }
          const c = ev.target.closest('[data-open]');
          if (c && !e.classList.contains('is-pulling')) openCase(c.dataset.open, c);
        });
        e._draw(false);
      } else if (!e._offFeed && $('.feed', body)) e._offFeed = wireFeed(body);
      return () => { if (e._offFeed) { e._offFeed(); e._offFeed = null; } };
    },
    beforeLeave(e, { to, params }) {
      if (to !== 'case') return;
      const stage = $(`[data-open="${params.id}"] .case__stage, [data-open="${params.id}"] .frow__ph`, e);
      if (stage) stage.style.viewTransitionName = 'hero-photo';
    },
    afterEnter(e, p, { back }) {
      if (!back || !lastOpened) return;
      const stage = $(`[data-open="${lastOpened}"] .case__stage, [data-open="${lastOpened}"] .frow__ph`, e);
      if (stage) stage.style.viewTransitionName = 'hero-photo';
    },
  };
  let lastOpened = null;
  function openCase(id, node) {
    lastOpened = id;
    M8.haptic.impact('medium');
    go('#/case/' + id);
  }
  function watchDrop(id, btn) {
    const on = !S().watch[id];
    M8.set((s) => ({ watch: { ...s.watch, [id]: on } }));
    M8.haptic.notify(on ? 'success' : 'warning');
    btn.textContent = on ? 'ВЫ НА НАБЛЮДЕНИИ ●' : 'УВЕДОМИТЬ МЕНЯ';
    btn.classList.toggle('btn--red', on);
    if (on) M8.toast('БОТ НАПИШЕТ В МОМЕНТ ДРОПА');
  }

  function caseHTML(p, i, n) {
    const isPhoto = !!p.photo;
    const bb = isPhoto ? p.bbox.front : [10, 12, 90, 90];
    const stage = isPhoto
      ? `<img class="case__lqip" src="${p.lqip.front}" alt="" aria-hidden="true"><img class="case__img" src="${M8.img(p, 'front', 720)}" srcset="${M8.srcset(p)}" sizes="(max-width: 480px) 86vw, 380px" alt="${M8.esc(p.title)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`
      : M8.flat(p.flat) + (p.status === 'drop' ? '<div class="redact" style="left:30%;right:30%;top:38%">ЗАСЕКРЕЧЕНО</div>' : '');
    const track = `<div class="track" style="left:${bb[0] + 4}%;top:${bb[1] + 2}%;right:${100 - bb[2] + 4}%;bottom:${100 - bb[3] + 2}%"><i></i><i></i><i></i><i></i><div class="track__lbl"><b>OBJ_${p.no}</b><span>${p.cat.toUpperCase()} · CONF <span data-conf>0.00</span></span></div></div>`;
    let info;
    if (p.status === 'drop') {
      info = `<span class="label">ДРОП · ${M8.date(new Date(p.dropAt))} · 20:00 МСК</span>${countHTML(p.dropAt)}
        <div class="case__row" style="pointer-events:auto"><span class="price">${M8.price(p.price)}</span><button class="btn ${S().watch[p.id] ? 'btn--red' : ''}" data-watch="${p.id}" type="button">${S().watch[p.id] ? 'ВЫ НА НАБЛЮДЕНИИ ●' : 'УВЕДОМИТЬ МЕНЯ'}</button></div>`;
    } else if (p.status === 'soldout') {
      info = `<h2 class="display case__title">${M8.esc(p.name)}<br>${M8.esc(p.sub)}</h2><p class="case__note">Вещдок изъят другим субъектом.</p><div class="case__row"><span class="price">${M8.price(p.price)}${p.old ? `<s>${M8.price(p.old)}</s>` : ''}</span><span class="case__open">ПРОТОКОЛ</span></div>`;
    } else {
      info = `<h2 class="display case__title">${M8.esc(p.name)}<br>${M8.esc(p.sub)}</h2><div class="case__row"><span class="price">${M8.price(p.price)}${p.old ? `<s>${M8.price(p.old)}</s>` : ''}</span><span class="case__open">ОТКРЫТЬ ДЕЛО</span></div>`;
    }
    return `<article class="case" data-open="${p.id}" data-i="${i}" tabindex="0" aria-label="${M8.esc(p.title)}">
      <div class="case__grid"></div>
      <div class="case__num" aria-hidden="true"><em>#</em>${p.no}</div>
      <div class="case__stage">${stage}${track}</div>
      ${p.status === 'soldout' ? `<div class="case__stampslot" aria-hidden="true" style="color:var(--mrak-red)">${M8.stampSVG('SOLD OUT', 'ВЕЩДОК ИЗЪЯТ', { w: 300, h: 100 })}</div>` : ''}
      <div class="case__top"><span class="label">ВЕЩДОК #${p.no} · ${p.catLabel} · ПАРТИЯ ${p.batch}</span>${stockTag(p)}</div>
      <div class="case__info">${info}</div>
      ${i === 0 && n > 1 ? '<div class="feedhint">↑ СЛЕДУЮЩЕЕ ДЕЛО</div>' : ''}
    </article>`;
  }
  function feedHTML(items) {
    if (!items.length) return `<div class="empty"><h2 class="display">ДЕЛ НЕ НАЙДЕНО</h2><p>В этой категории вещдоков нет. Пока.</p></div>`;
    return `<div class="ptr"><div class="ptr__eight" style="color:var(--mrak-cream)">${M8.eight()}</div><div class="ptr__lbl">ПОТЯНИ — ОБНОВИТЬ ДЕЛА</div></div>
      <div class="feed">${items.map((p, i) => caseHTML(p, i, items.length)).join('')}</div>
      <div class="feedprog" aria-hidden="true">${items.map((_, i) => `<i class="${i ? '' : 'is-on'}"></i>`).join('')}</div>`;
  }
  function filesHTML(items) {
    const rows = items.map((p) => {
      const ph = p.photo ? `<img src="${M8.img(p, 'front', 360)}" alt="" loading="lazy">` : M8.flat(p.flat);
      const sz = p.sizes.map((s) => (s.stock ? `<span>${s.s}</span>` : `<s>${s.s}</s>`)).join('');
      const n = M8.stockOf(p);
      const st = p.status === 'drop' ? 'ДРОП СКОРО' : p.status === 'soldout' ? 'SOLD OUT' : `ОСТ. ${n}`;
      return `<button class="frow" data-open="${p.id}" type="button">
        <span class="frow__no">#${p.no}<small>${p.sig}</small></span>
        <span class="frow__ph">${ph}</span>
        <span class="frow__t"><h3>${M8.esc(p.name)} ${M8.esc(p.sub)}</h3><span class="frow__sizes">${sz}</span></span>
        <span class="frow__r"><span class="price">${M8.price(p.price)}</span><span class="frow__stock ${p.status !== 'live' || n <= 5 ? 'is-low' : ''}">${st}</span></span>
      </button>`;
    }).join('');
    return `<div class="files"><div class="files__head label"><span>№</span><span>ФОТО</span><span>НАИМЕНОВАНИЕ</span><span>ЦЕНА</span></div>${rows}
      <div class="files__foot">ОПИСЬ СОСТАВЛЕНА ${M8.date()} · ВСЕГО ВЕЩДОКОВ: ${items.length}<br>${M8.esc(SLOGAN)}</div></div>`;
  }

  function wireFeed(body) {
    const feed = $('.feed', body);
    if (!feed) return () => {};
    const cases = $$('.case', feed);
    const prog = $$('.feedprog i', body);
    let raf = 0, active = -1;
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    const paint = () => {
      raf = 0;
      const H = feed.clientHeight || 1;
      cases.forEach((c, i) => {
        const p = (c.offsetTop - feed.scrollTop) / H;
        if (Math.abs(p) < 1.5) c.style.setProperty('--p', p.toFixed(3));
      });
      const idx = Math.round(feed.scrollTop / H);
      if (idx !== active) setActive(idx);
    };
    const setActive = (idx) => {
      active = idx;
      prog.forEach((t, i) => t.classList.toggle('is-on', i === idx));
      const c = cases[idx];
      if (!c || c.classList.contains('is-live')) return;
      c.classList.add('is-live');
      const tr = $('.track', c), conf = $('[data-conf]', c);
      M8.anim(tr, [{ transform: 'scale(1.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.4 }, { transform: 'scale(1.04)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 520, easing: 'steps(4, end)' });
      if (conf) {
        const target = 0.9 + Math.random() * 0.08, t0 = performance.now();
        const step = (now) => { const k = Math.min(1, (now - t0) / 700); conf.textContent = (target * k).toFixed(2); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
      if (idx > 0) M8.haptic.select();
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    feed.addEventListener('scroll', onScroll, { passive: true });
    paint();
    setActive(Math.round(feed.scrollTop / (feed.clientHeight || 1)));

    // tilt: gyroscope in Telegram (DeviceOrientation, Bot API 8.0), pointer on desktop
    let tiltRaf = 0;
    const applyTilt = () => {
      tiltRaf = 0;
      tilt.x += (tilt.tx - tilt.x) * 0.18; tilt.y += (tilt.ty - tilt.y) * 0.18;
      const c = cases[active];
      if (c) { c.style.setProperty('--tx', (tilt.x * 14).toFixed(2) + 'px'); c.style.setProperty('--ty', (tilt.y * 10).toFixed(2) + 'px'); c.style.setProperty('--rot', (tilt.x * 2.2).toFixed(2) + 'deg'); }
      if (Math.abs(tilt.tx - tilt.x) > 0.002 || Math.abs(tilt.ty - tilt.y) > 0.002) tiltRaf = requestAnimationFrame(applyTilt);
    };
    const kick = () => { if (!tiltRaf && !M8.reduced) tiltRaf = requestAnimationFrame(applyTilt); };
    const stopOri = M8.startOrientation((beta, gamma) => { tilt.tx = M8.clamp(gamma / 0.5, -1, 1); tilt.ty = M8.clamp((beta - 0.7) / 0.5, -1, 1); kick(); });
    const onMove = (ev) => {
      if (ev.pointerType === 'touch') return;
      const r = feed.getBoundingClientRect();
      tilt.tx = ((ev.clientX - r.left) / r.width - 0.5) * 2; tilt.ty = ((ev.clientY - r.top) / r.height - 0.5) * 2; kick();
    };
    feed.addEventListener('pointermove', onMove);

    // swipe-tilt fallback on touch (horizontal drag nudges the item)
    let sx = null;
    const ts = (ev) => { sx = ev.touches[0].clientX; };
    const tm = (ev) => { if (sx == null) return; tilt.tx = M8.clamp((ev.touches[0].clientX - sx) / 120, -1, 1); kick(); };
    const te = () => { sx = null; tilt.tx = 0; tilt.ty = 0; kick(); };
    feed.addEventListener('touchstart', ts, { passive: true });
    feed.addEventListener('touchmove', tm, { passive: true });
    feed.addEventListener('touchend', te);

    const offPTR = wirePTR(body, feed);
    return () => { feed.removeEventListener('scroll', onScroll); feed.removeEventListener('pointermove', onMove); stopOri(); offPTR(); cancelAnimationFrame(raf); cancelAnimationFrame(tiltRaf); };
  }

  // pull to refresh with the 8-scanner
  function wirePTR(body, feed) {
    const ptr = $('.ptr', body), eight = $('.ptr__eight', body), lbl = $('.ptr__lbl', body);
    const cat = body.closest('.cat');
    let y0 = null, dist = 0, busy = false, stopSpin = null;
    const set = (d) => {
      dist = d;
      const k = Math.min(1, d / 90);
      eight.style.opacity = k; lbl.style.opacity = k;
      eight.style.transform = `translateY(${Math.min(d, 110) * 0.6 - 20}px) rotate(${d * 3}deg)`;
      $$('.ring', eight).forEach((r, i) => (r.style.transform = i ? `rotateY(${d * 4}deg)` : `rotateX(${d * 5}deg)`));
      feed.style.transform = d ? `translateY(${Math.min(d, 110) * 0.5}px)` : '';
      lbl.textContent = d > 80 ? 'ОТПУСТИ — ПЕРЕСМОТР ДЕЛ' : 'ПОТЯНИ — ОБНОВИТЬ ДЕЛА';
    };
    const down = (ev) => { if (busy || feed.scrollTop > 2) return; y0 = ev.clientY; };
    const move = (ev) => {
      if (y0 == null) return;
      const d = ev.clientY - y0;
      if (d > 8) { cat.classList.add('is-pulling'); if (ev.cancelable) ev.preventDefault(); set((d - 8) * 0.8); if (Math.abs(dist - 80) < 3) M8.haptic.select(); }
      else if (d < -4) y0 = null;
    };
    const up = async () => {
      if (y0 == null) return;
      y0 = null;
      setTimeout(() => cat.classList.remove('is-pulling'), 30);
      if (dist > 80) {
        busy = true; M8.haptic.impact('medium');
        lbl.textContent = 'ПЕРЕСМОТР ДЕЛ…';
        feed.style.transition = 'transform .3s'; feed.style.transform = 'translateY(54px)';
        stopSpin = M8.spinEight(eight, 1.4);
        await M8.wait(1100);
        stopSpin();
        feed.style.transform = ''; set(0);
        setTimeout(() => (feed.style.transition = ''), 320);
        M8.toast('ДЕЛА АКТУАЛЬНЫ · ВЕЩДОКОВ: ' + M8.products.length);
        busy = false;
      } else { feed.style.transition = 'transform .25s'; set(0); setTimeout(() => (feed.style.transition = ''), 260); }
    };
    feed.addEventListener('pointerdown', down);
    feed.addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    const tmv = (ev) => { if (y0 != null && ev.touches[0].clientY - y0 > 8 && ev.cancelable) ev.preventDefault(); };
    feed.addEventListener('touchmove', tmv, { passive: false });
    return () => { feed.removeEventListener('pointerdown', down); feed.removeEventListener('pointermove', move); removeEventListener('pointerup', up); feed.removeEventListener('touchmove', tmv); };
  }

  /* ========================================================= PRODUCT CASE */
  const RULER = { from: 150, to: 200, h: 320 };
  screens.case = {
    tab: 'catalog', parent: '#/',
    render({ id }) {
      const p = M8.product(id) || M8.products[0];
      const face = (side) => {
        if (!p.photo) return `<div class="face face--${side}">${M8.flat(p.flat)}</div>`;
        const marks = (p.hot[side] || []).map((m, i) => `<button class="mark" type="button" data-hot="${side}:${i}" style="left:${m.x}%;top:${m.y}%" aria-label="Деталь ${i + 1}: ${M8.esc(m.t)}">${i + 1}</button>`).join('');
        return `<div class="face face--${side}"><img class="lq" src="${p.lqip[side]}" alt="" aria-hidden="true"><img class="hi" src="${M8.img(p, side, 1200)}" srcset="${M8.srcset(p, side)}" sizes="(max-width:480px) 92vw, 400px" alt="${M8.esc(p.title)} — ${side === 'front' ? 'фас' : 'спина'}" decoding="async">${marks}</div>`;
      };
      const avail = p.sizes.filter((s) => s.stock > 0);
      return el(`<section class="screen dossier" aria-label="${M8.esc(p.title)}">
        <div class="hero" data-face="front">
          <div class="hchart" style="color:var(--mrak-cream)">${M8.hchart({ from: 150, to: 200, strong: 0.2, weak: 0.08 })}${chartLabels(150, 200, 10)}</div>
          <div class="hero__num" aria-hidden="true">#${p.no}</div>
          <div class="flip"><div class="flip__in">${face('front')}${p.photo ? face('back') : ''}</div></div>
          <div class="scanline"></div>
          <div class="loupe__line"></div>
          <div class="loupe" aria-hidden="true"><div class="loupe__glass"></div><div class="loupe__cap"></div></div>
          ${p.photo ? '<div class="hero__swipe">← СВАЙП — ПОВЕРНУТЬ ВЕЩДОК →</div>' : ''}
          <div class="hero__ui">
            ${p.photo ? '<div class="facesw" role="group" aria-label="Ракурс"><button type="button" data-face="front" class="is-on">ФАС</button><button type="button" data-face="back">СПИНА</button></div>' : '<span></span>'}
            <div class="placard"><span>MRAK8 · ВЕЩДОК</span><b data-placard>#${p.no} · ФАС</b><span>${M8.date()}</span></div>
          </div>
        </div>
        <div class="dtitle">
          <span class="label">ДЕЛО #${p.no} · ${p.catLabel} · ПАРТИЯ ${p.batch} · ${p.sig}</span>
          <h1 class="display">${M8.esc(p.name)}<br>${M8.esc(p.sub)}</h1>
          <div class="row"><span class="price">${M8.price(p.price)}${p.old ? `<s>${M8.price(p.old)}</s>` : ''}${p.todo && p.todo.price ? '<span class="todo">TODO</span>' : ''}</span>${stockTag(p)}</div>
          ${p.status === 'drop' ? countHTML(p.dropAt) : ''}
          ${p.status === 'soldout' ? '<p class="case__note">Вещдок изъят другим субъектом. Следующая партия — по решению центра.</p>' : ''}
        </div>
        ${tape(SLOGAN)}
        ${p.status === 'live' ? sizerHTML(p) : ''}
        <section class="proto">
          <div class="proto__h"><h2>Протокол осмотра</h2><span class="label">ФОРМА 8-ОСМ</span></div>
          <dl>${p.proto.map(([k, v, todo]) => `<div class="kv"><dt>${k}</dt><dd>${M8.esc(v)}${todo ? '<span class="todo">TODO</span>' : ''}</dd></div>`).join('')}</dl>
          <p class="proto__note">Вещдок выдаётся после оформления протокола. Срок этапирования 1–3 дня. Возврат — 14 дней, если вещь не носили.</p>
        </section>
        ${tape('MRAK8 CENTRAL BOOKING & INTAKE CENTER · ДЕЛО #' + p.no, 'tape--dark', 30)}
        <div style="height:24px"></div>
      </section>`);
    },
    mount(e, { id }) {
      const p = M8.product(id) || M8.products[0];
      const offs = [];
      const hero = $('.hero', e);
      // hi-res load + red scan line
      const scan = $('.scanline', hero);
      const flip = $('.flip', hero);
      const sweep = (n = 1) => M8.anim(scan, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 1, transform: `translateY(${flip.offsetTop + flip.offsetHeight}px)`, offset: 0.92 }, { opacity: 0, transform: `translateY(${flip.offsetTop + flip.offsetHeight}px)` }], { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)', iterations: n });
      const his = $$('.hi', hero);
      let scanning = sweep(Infinity);
      let loaded = 0;
      const ready = () => { if (++loaded >= Math.min(1, his.length)) { scanning.cancel && scanning.cancel(); sweep(1); } };
      his.forEach((img) => { const fin = () => { img.classList.add('is-in'); ready(); }; img.complete && img.naturalWidth ? fin() : img.addEventListener('load', fin, { once: true }); });
      if (!his.length) { scanning.cancel && scanning.cancel(); sweep(1); }
      if (p.photo) setTimeout(() => { const sw = $('.hero__swipe', hero); sw && sw.classList.add('is-on'); }, 900);

      if (p.photo) offs.push(wireHero(e, p));
      if (p.status === 'live') offs.push(wireSizer(e, p));
      const refreshMain = () => productMain(e, p);
      refreshMain();
      return () => offs.forEach((f) => f && f());
    },
  };

  function productMain(e, p) {
    if (p.status === 'drop') {
      const on = !!S().watch[p.id];
      M8.main({ visible: true, text: on ? 'ВЫ НА НАБЛЮДЕНИИ ●' : 'УВЕДОМИТЬ МЕНЯ О ДРОПЕ', color: on ? '#1C1C1C' : '#E0241B', textColor: on ? '#F1ECE1' : '#FFFFFF', shine: !on, fn: () => { const b = document.createElement('button'); watchDrop(p.id, b); productMain(e, p); } });
      return;
    }
    if (p.status === 'soldout') {
      M8.main({ visible: true, text: 'УВЕДОМИТЬ О НОВОЙ ПАРТИИ', color: '#1C1C1C', textColor: '#F1ECE1', fn: () => { M8.haptic.notify('success'); M8.toast('ВЫ В СПИСКЕ НАБЛЮДЕНИЯ'); } });
      return;
    }
    const size = e._size;
    const inCart = S().cart.some((c) => c.id === p.id && c.size === size);
    if (inCart) {
      M8.main({ visible: true, text: `ОФОРМИТЬ ПРОТОКОЛ — ${M8.price(cartTotal())}`, color: '#E0241B', shine: false, fn: () => { M8.haptic.impact('medium'); go('#/protocol'); } });
      M8.secondary({ visible: true, text: 'ЕЩЁ ВЕЩДОКИ', position: 'left', fn: () => { M8.haptic.impact('light'); go('#/'); } });
    } else {
      M8.main({ visible: true, text: `ИЗЪЯТЬ — ${M8.price(p.price)}`, color: '#E0241B', shine: true, fn: () => seize(e, p) });
      M8.secondary({ visible: false });
    }
  }

  async function seize(e, p) {
    const size = e._size;
    const sz = sizeOf(p, size);
    if (!sz || !sz.stock) { M8.haptic.notify('error'); M8.toast('РАЗМЕР ИЗЪЯТ ДРУГИМ СУБЪЕКТОМ'); return; }
    const hero = $('.hero', e);
    const face = hero.dataset.face || 'front';
    M8.main({ active: false, shine: false });
    const st = await M8.slam(hero, 'ИЗЪЯТО', { sub: `ВЕЩДОК #${p.no} · РАЗМЕР ${size}`, rot: -10, cls: 'dstamp', w: 300, h: 100 });
    M8.set((s) => {
      const cart = s.cart.map((c) => ({ ...c }));
      const row = cart.find((c) => c.id === p.id && c.size === size);
      if (row) row.qty = Math.min(row.qty + 1, sz.stock); else cart.push({ id: p.id, size, qty: 1 });
      return { cart };
    });
    const img = $(`.face--${face} .hi`, hero) || $(`.face--${face} img`, hero);
    await M8.flyToBag(img, M8.img(p, face, 360));
    M8.main({ active: true });
    productMain(e, p);
    setTimeout(() => M8.anim(st, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(() => st.remove()), 900);
  }

  function wireHero(e, p) {
    const hero = $('.hero', e), inner = $('.flip__in', hero), loupe = $('.loupe', hero), line = $('.loupe__line', hero);
    const glass = $('.loupe__glass', loupe), cap = $('.loupe__cap', loupe);
    let ry = 0, face = 'front', start = null, moved = false, hiRes = {};
    const setFace = (f, anim = true) => {
      if (f !== face) M8.haptic.select();
      face = f; hero.dataset.face = f; ry = f === 'front' ? 0 : 180;
      inner.classList.toggle('is-anim', anim);
      inner.style.setProperty('--ry', ry + 'deg');
      $$('.facesw button', hero).forEach((b) => b.classList.toggle('is-on', b.dataset.face === f));
      const pl = $('[data-placard]', hero); if (pl) M8.scramble(pl, `#${p.no} · ${f === 'front' ? 'ФАС' : 'СПИНА'}`, 240);
      closeLoupe();
    };
    const openLoupe = (side, x, y, title, sub) => {
      const fl = $('.flip', hero), fr = fl.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      const S2 = fr.width, Z = 3.2, G = 156;
      if (!hiRes[side]) { hiRes[side] = `${p.photo[side]}-2400.webp`; }
      glass.style.backgroundImage = `url(${hiRes[side]}), url(${M8.img(p, side, 1200)})`;
      glass.style.backgroundSize = `${S2 * Z}px ${S2 * Z}px`;
      glass.style.backgroundPosition = `${G / 2 - (x / 100) * S2 * Z}px ${G / 2 - (y / 100) * S2 * Z}px`;
      cap.innerHTML = `ФИГ. ${M8.esc(title)}<span>${M8.esc(sub)} · УВЕЛ. ×${Z}</span>`;
      const px = fr.left - hr.left + (x / 100) * S2, py = fr.top - hr.top + (y / 100) * S2;
      const left = px > hr.width / 2 ? Math.max(8, px - G - 44) : Math.min(hr.width - G - 8, px + 44);
      const top = M8.clamp(py - G / 2, 8, hr.height - G - 70);
      loupe.style.left = left + 'px'; loupe.style.top = top + 'px';
      loupe.style.setProperty('--ox', (px - left) + 'px'); loupe.style.setProperty('--oy', (py - top) + 'px');
      loupe.classList.add('is-on');
      const lx = px > hr.width / 2 ? left + G : left, ly = top + G / 2;
      const dx = lx - px, dy = ly - py, len = Math.hypot(dx, dy);
      line.style.left = px + 'px'; line.style.top = py + 'px'; line.style.width = len + 'px';
      line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      M8.anim(line, [{ opacity: 0, transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(0)` }, { opacity: 1, transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(1)` }], { duration: 220, fill: 'forwards', easing: 'cubic-bezier(.16,1,.3,1)' });
      M8.haptic.impact('soft');
    };
    function closeLoupe() {
      loupe.classList.remove('is-on');
      line.getAnimations && line.getAnimations().forEach((a) => a.cancel());
      line.style.opacity = 0;
      $$('.mark', hero).forEach((m) => m.classList.remove('is-on'));
    }
    const down = (ev) => {
      if (ev.target.closest('.facesw, .placard')) return;
      start = { x: ev.clientX, y: ev.clientY, ry }; moved = false;
      inner.classList.remove('is-anim');
    };
    const move = (ev) => {
      if (!start) return;
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { moved = true; closeLoupe(); hero.setPointerCapture && hero.setPointerCapture(ev.pointerId); }
      if (moved) { inner.style.setProperty('--ry', start.ry + dx * 0.55 + 'deg'); inner.style.setProperty('--rx', M8.clamp(-dy * 0.05, -6, 6) + 'deg'); }
    };
    const up = (ev) => {
      if (!start) return;
      const dx = ev.clientX - start.x;
      inner.style.setProperty('--rx', '0deg');
      if (moved) {
        const next = Math.abs(dx) > 60 ? (face === 'front' ? 'back' : 'front') : face;
        setFace(next);
      } else {
        const mk = ev.target.closest('.mark');
        const fb = ev.target.closest('.facesw button');
        if (fb) setFace(fb.dataset.face);
        else if (mk) {
          const [side, i] = mk.dataset.hot.split(':'); const hs = p.hot[side][+i];
          const was = mk.classList.contains('is-on');
          closeLoupe();
          if (!was) { mk.classList.add('is-on'); openLoupe(side, hs.fx ?? hs.x, hs.fy ?? hs.y, `${+i + 1} — ${hs.t}`, hs.s); }
        } else if (ev.target.closest('.face')) {
          const fr = $('.flip', hero).getBoundingClientRect();
          const x = ((ev.clientX - fr.left) / fr.width) * 100, y = ((ev.clientY - fr.top) / fr.height) * 100;
          if (loupe.classList.contains('is-on')) closeLoupe();
          else if (x > 0 && x < 100 && y > 0 && y < 100) openLoupe(face, x, y, `УЧАСТОК ${Math.round(x)}/${Math.round(y)}`, face === 'front' ? 'ФАС' : 'СПИНА');
        } else closeLoupe();
      }
      start = null;
    };
    hero.addEventListener('pointerdown', down);
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerup', up);
    hero.addEventListener('pointercancel', () => { if (start) { setFace(face); start = null; } });
    $$('.facesw button', hero).forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); setFace(b.dataset.face); }));
    // preload backside hi-res after first paint
    setTimeout(() => { const i = new Image(); i.src = M8.img(p, 'back', 1200); }, 600);
    return () => {};
  }

  /* ruler: height -> size */
  function sizerHTML(p) {
    const { from, to, h: H } = RULER;
    const y = (v) => ((to - v) / (to - from)) * H;
    let ticks = `<svg width="100%" height="${H}" aria-hidden="true" style="position:absolute;inset:0">`;
    for (let v = from; v <= to; v++) {
      const yy = y(v) + 0.5, maj = v % 5 === 0, lab = v % 10 === 0;
      ticks += `<line x1="0" x2="${lab ? 26 : maj ? 16 : 8}" y1="${yy}" y2="${yy}" stroke="#8A8680" stroke-opacity="${lab ? 0.9 : maj ? 0.6 : 0.32}"/>`;
      if (lab && v !== from && v !== to) ticks += `<text x="2" y="${yy - 3}" fill="#8A8680" font-family="JetBrains Mono" font-size="8" font-weight="600">${v}</text>`;
    }
    ticks += '</svg>';
    const bands = p.sizes.map((s) => `<div class="ruler__band ${s.stock ? '' : 'is-out'}" data-band="${s.s}" style="top:${y(s.h[1])}px;height:${y(s.h[0]) - y(s.h[1])}px"><b>${s.s}</b><small>${s.h[0]}–${s.h[1]}</small></div>`).join('');
    return `<section class="sizer" aria-label="Подбор размера">
      <div class="sec-h"><span class="label"><b>02</b> · РАЗМЕР ПО РОСТОМЕРУ</span><span class="label">ТЯНИ МЕТКУ ↕</span></div>
      <div class="sizer__body">
        <div class="ruler" role="slider" tabindex="0" aria-label="Ваш рост, см" aria-valuemin="${from}" aria-valuemax="${to}">
          <div class="ruler__ticks">${ticks}</div>${bands}
          <div class="ruler__mark"><div class="ruler__handle"><span data-h>176</span><span>СМ</span></div></div>
        </div>
        <div class="readout">
          <div class="big"><b data-size>M</b><span>РАЗМЕР<br>ПО РОСТУ</span></div>
          <dl>
            <div class="kv"><dt>РОСТ</dt><dd data-r="h">—</dd></div>
            <div class="kv"><dt>ДЛИНА</dt><dd data-r="len">—</dd></div>
            <div class="kv"><dt>ШИРИНА</dt><dd data-r="w">—</dd></div>
            <div class="kv"><dt>РУКАВ</dt><dd data-r="sl">—</dd></div>
            <div class="kv" data-stockrow><dt>ОСТАТОК</dt><dd data-r="st">—</dd></div>
          </dl>
          <div class="remember">РОСТ ПОДШИВАЕТСЯ К ДЕЛУ #${M8.subject}</div>
        </div>
      </div>
      <div class="sizebtns" role="group" aria-label="Размер">${p.sizes.map((s) => `<button type="button" data-s="${s.s}" ${s.stock ? '' : 'disabled aria-disabled="true"'}>${s.s}</button>`).join('')}</div>
      <div class="sizer__hint"><span>ЗАМЕРЫ ИЗДЕЛИЯ, СМ · ПО ПЛОСКОСТИ</span>${p.todo && p.todo.sizes ? '<span class="todo">TODO: СЕТКА</span>' : ''}</div>
    </section>`;
  }
  function wireSizer(e, p) {
    const { from, to, h: H } = RULER;
    const ruler = $('.ruler', e), mark = $('.ruler__mark', e), hOut = $('[data-h]', e), big = $('[data-size]', e);
    const R = (k) => $(`[data-r="${k}"]`, e);
    const bandOf = (v) => p.sizes.find((s) => v >= s.h[0] && v < s.h[1]) || (v >= p.sizes[p.sizes.length - 1].h[1] ? p.sizes[p.sizes.length - 1] : p.sizes[0]);
    const center = (s) => Math.round((s.h[0] + s.h[1]) / 2);
    const nearestAvail = (v) => p.sizes.filter((s) => s.stock).sort((a, b) => Math.abs(center(a) - v) - Math.abs(center(b) - v))[0];
    let hgt = S().height || 176, size = null, lastTick = 0, lastCm = null;
    const yOf = (v) => ((to - v) / (to - from)) * H;
    const render = (v, { snap = false } = {}) => {
      hgt = v;
      mark.style.transition = snap ? 'transform .45s cubic-bezier(.3,1.5,.5,1)' : 'none';
      mark.style.setProperty('--y', yOf(v) + 'px');
      hOut.textContent = v;
      const b = bandOf(v);
      ruler.setAttribute('aria-valuenow', v);
      ruler.setAttribute('aria-valuetext', `${v} см, размер ${b.s}${b.stock ? '' : ' — нет в наличии'}`);
      R('h').textContent = v + ' СМ';
      if (b.s !== size) {
        size = b.s;
        $$('.ruler__band', e).forEach((n) => n.classList.toggle('is-on', n.dataset.band === b.s));
        $$('.sizebtns button', e).forEach((n) => n.classList.toggle('is-on', n.dataset.s === b.s));
        M8.scramble(big, b.s, 200);
        M8.scramble(R('len'), b.m[0] + ' СМ'); M8.scramble(R('w'), b.m[1] + ' СМ'); M8.scramble(R('sl'), b.m[2] + ' СМ');
        R('st').textContent = b.stock ? b.stock + ' ШТ' : 'ИЗЪЯТ';
        $('[data-stockrow]', e).classList.toggle('stock-low', b.stock <= 3);
        if (b.stock) { e._size = b.s; productMain(e, p); }
      }
    };
    const commit = () => {
      const b = bandOf(hgt);
      if (!b.stock) {
        const n = nearestAvail(hgt);
        M8.haptic.notify('warning');
        M8.toast(`${b.s} — ИЗЪЯТ ДРУГИМ СУБЪЕКТОМ. ПРЕДЛАГАЕМ ${n.s}`);
        render(center(n), { snap: true });
      }
      M8.set({ height: hgt });
    };
    const fromY = (clientY) => {
      const r = ruler.getBoundingClientRect();
      return Math.round(M8.clamp(to - ((clientY - r.top) / r.height) * (to - from), from, to - 1));
    };
    let drag = false;
    const down = (ev) => { drag = true; ruler.classList.add('is-drag'); ruler.setPointerCapture(ev.pointerId); move(ev); };
    const move = (ev) => {
      if (!drag) return;
      const v = fromY(ev.clientY);
      if (v !== lastCm) {
        const now = performance.now();
        const prevSize = size;
        render(v);
        if (size !== prevSize) M8.haptic.impact('light');
        else if (now - lastTick > 34) { M8.haptic.select(); lastTick = now; }
        lastCm = v;
      }
    };
    const up = () => { if (!drag) return; drag = false; ruler.classList.remove('is-drag'); commit(); };
    ruler.addEventListener('pointerdown', down);
    ruler.addEventListener('pointermove', move);
    ruler.addEventListener('pointerup', up);
    ruler.addEventListener('pointercancel', up);
    ruler.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); render(M8.clamp(hgt + (ev.key === 'ArrowUp' ? 1 : -1), from, to - 1)); M8.haptic.select(); }
      if (ev.key === 'Enter') commit();
    });
    $$('.sizebtns button', e).forEach((b) => b.addEventListener('click', () => { const s = sizeOf(p, b.dataset.s); M8.haptic.select(); render(center(s), { snap: true }); M8.set({ height: center(s) }); }));
    // initial: remembered height, but never land on a seized size
    const b0 = bandOf(hgt);
    render(b0.stock ? hgt : center(nearestAvail(hgt)));
    return () => {};
  }

  /* ================================================================== BAG */
  screens.bag = {
    root: true, tab: 'bag', camLabel: 'PERSONAL PROPERTY',
    render() { return el('<section class="screen" aria-label="Пакет"></section>'); },
    mount(e) {
      const draw = () => {
        if (!S().cart.length) {
          e.innerHTML = `<div class="empty"><div class="empty__bag"><span>EVIDENCE</span></div><h2 class="display">Изъятых вещей нет.</h2><p>Подозрительно.</p><button class="btn" data-go="#/" type="button">К вещдокам</button></div>`;
          M8.main({ visible: false }); M8.secondary({ visible: false });
          return;
        }
        const rows = S().cart.map((c, i) => {
          const p = M8.product(c.id);
          return `<li class="irow" data-row="${i}"><div class="irow__del">ВЕРНУТЬ<br>СУБЪЕКТУ</div><div class="irow__in">
            <span class="irow__n">${M8.pad(i + 1)}.</span>
            <span class="irow__t">${M8.esc(p.title)} / ${c.size} / ×${c.qty}<small>ВЕЩДОК #${p.no} · ${p.color}</small>
              <span class="irow__qty"><button type="button" data-q="-1" aria-label="Меньше">−</button><output>×${c.qty}</output><button type="button" data-q="1" aria-label="Больше">+</button></span></span>
            <span class="irow__p">${M8.price(p.price * c.qty)}</span></div></li>`;
        }).join('');
        const thumbs = S().cart.slice(0, 4).map((c, i) => {
          const p = M8.product(c.id);
          const pos = [[4, 4, -7], [34, 0, 6], [62, 6, -3], [18, 8, 10]][i];
          const st = `left:${pos[0]}%;top:${pos[1]}px;transform:rotate(${pos[2]}deg)`;
          return p.photo ? `<img src="${M8.img(p, 'front', 360)}" alt="" style="${st}">` : `<div class="flat" style="${st};position:absolute;width:112px;height:112px">${M8.flat(p.flat)}</div>`;
        }).join('');
        e.innerHTML = `<div class="bagscr">
          <div class="scr-h"><div><span class="label">PERSONAL PROPERTY · ОПИСЬ</span><h1 class="display">Личные вещи</h1></div><span class="label">ПРЕДМЕТОВ: <b style="color:var(--mrak-cream)">${cartCount()}</b></span></div>
          <div class="bag">
            <div class="zip"><div class="zip__teeth"></div><div class="zip__pull"></div></div>
            <div class="bag__label">EVIDENCE</div>
            <div class="bag__items">${thumbs}</div>
            <div class="paper"><i class="tag-hole"></i>
              <div class="inv__h">${M8.logo()}<h2>Опись изъятого</h2></div>
              <div class="inv__meta"><span>SUBJECT <b>#${M8.subject}</b></span><span>ДАТА <b>${M8.date()}</b></span><span>CASE <b>— НЕ ПРИСВОЕН</b></span><span>ВРЕМЯ <b data-clock>${M8.time()}</b></span></div>
              <ul class="inv__rows">${rows}</ul>
              <div class="inv__tot"><span>Итого</span><b>${M8.price(cartTotal())}</b></div>
              <div class="inv__sig"><span>ИЗЪЯЛ: ДЕЖУРНЫЙ MRAK8</span><span>ПОДПИСЬ: __________</span></div>
            </div>
          </div>
          <p class="bag__hint">← СВАЙП ПО СТРОКЕ — ВЕРНУТЬ ВЕЩЬ</p>
        </div>`;
        M8.main({ visible: true, text: `ОФОРМИТЬ ПРОТОКОЛ — ${M8.price(cartTotal())}`, shine: true, fn: seal });
        M8.secondary({ visible: false });
        wireRows();
      };
      const seal = async () => {
        M8.main({ active: false, shine: false });
        const pull = $('.zip__pull', e), teeth = $('.zip__teeth', e);
        if (pull) {
          const w = teeth.offsetWidth;
          M8.haptic.impact('rigid');
          await M8.done(M8.anim(pull, [{ transform: 'translateX(0)' }, { transform: `translateX(${-w}px)` }], { duration: 420, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), 520);
          M8.haptic.impact('light');
          await M8.wait(120);
        }
        M8.main({ active: true });
        go('#/protocol');
      };
      const wireRows = () => {
        $$('.irow', e).forEach((row) => {
          const inn = $('.irow__in', row); const i = +row.dataset.row;
          let x0 = null, dx = 0;
          inn.addEventListener('pointerdown', (ev) => { if (ev.target.closest('button')) return; x0 = ev.clientX; dx = 0; inn.style.transition = 'none'; });
          inn.addEventListener('pointermove', (ev) => { if (x0 == null) return; dx = Math.min(0, ev.clientX - x0); if (dx < -6) inn.setPointerCapture(ev.pointerId); inn.style.transform = `translateX(${Math.max(dx, -120)}px)`; });
          const end = () => { if (x0 == null) return; x0 = null; inn.style.transition = 'transform .25s cubic-bezier(.16,1,.3,1)'; if (dx < -84) remove(row, i); else inn.style.transform = ''; };
          inn.addEventListener('pointerup', end); inn.addEventListener('pointercancel', end);
          $('.irow__del', row).addEventListener('click', () => remove(row, i));
          $$('[data-q]', row).forEach((b) => b.addEventListener('click', () => {
            const d = +b.dataset.q; const c = S().cart[i]; const p = M8.product(c.id); const sz = sizeOf(p, c.size);
            const q2 = c.qty + d;
            if (q2 < 1) return remove(row, i);
            if (q2 > sz.stock) { M8.haptic.notify('error'); M8.toast(`В НАЛИЧИИ ТОЛЬКО ${sz.stock} ШТ`); return; }
            M8.haptic.select();
            M8.set((s) => ({ cart: s.cart.map((r, k) => (k === i ? { ...r, qty: q2 } : r)) }));
            draw();
          }));
        });
      };
      const remove = async (row, i) => {
        const inn = $('.irow__in', row);
        inn.style.transform = '';
        const w = row.offsetWidth;
        const svg = el(`<svg class="strike" viewBox="0 0 ${w} 20" preserveAspectRatio="none"><path d="${M8.strikePath(w)}" fill="none" stroke="#E0241B" stroke-width="3.2" stroke-linecap="round" stroke-opacity=".92"/></svg>`);
        row.appendChild(svg);
        const path = $('path', svg), len = path.getTotalLength();
        path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
        M8.haptic.impact('medium');
        await M8.done(M8.anim(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 300, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), 400);
        inn.style.opacity = '.45';
        await M8.wait(260);
        await M8.done(M8.anim(row, [{ height: row.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), 340);
        const removed = S().cart[i];
        M8.set((s) => ({ cart: s.cart.filter((_, k) => k !== i) }));
        draw();
        M8.toast('ВЕЩЬ ВОЗВРАЩЕНА СУБЪЕКТУ', { action: 'Отменить', onAction: () => { M8.set((s) => { const c = s.cart.slice(); c.splice(i, 0, removed); return { cart: c }; }); draw(); } });
      };
      draw();
      return () => {};
    },
  };

  /* ============================================================ PROTOCOL */
  const form = { name: '', phone: '', delivery: 'cdek', address: '', comment: '', agree: false };
  screens.protocol = {
    tab: 'bag', parent: '#/bag',
    render() { return el('<section class="screen protocol" aria-label="Протокол оформления"></section>'); },
    mount(e) {
      if (!S().cart.length) { e.innerHTML = `<div class="empty"><h2 class="display">Протокол пуст</h2><p>Нечего оформлять: пакет пуст.</p><button class="btn" data-go="#/" type="button">К вещдокам</button></div>`; return; }
      if (!form.name) form.name = [M8.user.first_name, M8.user.last_name].filter(Boolean).join(' ');
      const dv = () => M8.DELIVERY.find((d) => d.k === form.delivery);
      const total = () => cartTotal() + dv().p;
      const items = S().cart.map((c) => { const p = M8.product(c.id); return `<div class="sumrow"><span>${M8.esc(p.name)} / ${c.size} ×${c.qty}</span><i></i><span>${M8.price(p.price * c.qty)}</span></div>`; }).join('');
      e.innerHTML = `<div class="form" role="form">
        <div class="form__perf" aria-hidden="true"></div>
        <div class="form__top">${M8.logo()}<div class="form__no">ФОРМА № 8-ПРК · ЭКЗ. 1<br>CASE <b>#MRK-—</b> (ПРИСВАИВАЕТСЯ ПРИ ОПЛАТЕ)</div></div>
        <h1>Протокол<br>оформления</h1>
        <div class="form__sub">SUBJECT #${M8.subject} · ${M8.date()} · <span data-clock>${M8.time()}</span></div>
        <div class="fsec"><div class="fsec__h"><i>1</i>Субъект</div>
          <label class="field" data-f="name"><span class="field__l">ФИО субъекта <span>ИЗ TELEGRAM</span></span><input name="name" autocomplete="name" value="${M8.esc(form.name)}" placeholder="Фамилия Имя"><span class="field__err">ОБЯЗАТЕЛЬНО</span></label>
          <label class="field" data-f="phone"><span class="field__l">Телефон <button type="button" class="linkbtn" data-contact>Подтянуть из Telegram</button></span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" value="${M8.esc(form.phone)}" placeholder="+7 ___ ___-__-__"><span class="field__err">ОБЯЗАТЕЛЬНО</span></label>
        </div>
        <div class="fsec"><div class="fsec__h"><i>2</i>Этапирование · доставка</div>
          <div class="opts" role="radiogroup">${M8.DELIVERY.map((d) => `<button type="button" role="radio" aria-checked="${d.k === form.delivery}" class="opt ${d.k === form.delivery ? 'is-on' : ''}" data-dv="${d.k}"><span class="opt__box"></span><span><b>${d.t}</b><small>${d.s}</small></span><span class="opt__p">${d.p ? M8.price(d.p) : '0 ₽'}</span></button>`).join('')}</div>
          <label class="field" data-f="address" ${form.delivery === 'pickup' ? 'hidden' : ''}><span class="field__l">Адрес доставки / ПВЗ</span><textarea name="address" rows="2" autocomplete="street-address" placeholder="Город, улица, дом, кв. — или код ПВЗ">${M8.esc(form.address)}</textarea><span class="field__err">ОБЯЗАТЕЛЬНО</span></label>
          <label class="field"><span class="field__l">Комментарий к делу <span>НЕОБЯЗАТЕЛЬНО</span></span><input name="comment" value="${M8.esc(form.comment)}" placeholder="—"></label>
        </div>
        <div class="fsec"><div class="fsec__h"><i>3</i>Изъято</div>
          <div class="sumrows">${items}<div class="sumrow"><span>Доставка · ${dv().t}</span><i></i><span data-dvp>${dv().p ? M8.price(dv().p) : '0 ₽'}</span></div>
          <div class="sumrow is-total"><span>Итого к оформлению</span><i></i><b data-total>${M8.price(total())}</b></div></div>
        </div>
        <button type="button" class="agree ${form.agree ? 'is-on' : ''}" data-agree role="checkbox" aria-checked="${form.agree}"><span class="opt__box"></span><span>С условиями содержания ознакомлен(а): <a href="#" onclick="return false">оферта</a>, <a href="#" onclick="return false">политика данных</a>.</span></button>
        <div class="sign"><div><div class="sign__box"><svg viewBox="0 0 240 62" preserveAspectRatio="none"><path data-sig fill="none" stroke="#0B0B0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="" /></svg></div><div class="sign__l"><span>Подпись субъекта</span><span>@${M8.esc(M8.user.username || 'subject')}</span></div></div><div class="mp">М.П.</div></div>
        <p class="form__foot">Чек по 54-ФЗ придёт на телефон / в Telegram. Оплата — Telegram Payments · ЮKassa. ${M8.inTG ? '' : 'Прототип: платёж эмулируется.'}</p>
      </div>`;
      const sync = () => {
        $('[data-dvp]', e).textContent = dv().p ? M8.price(dv().p) : '0 ₽';
        $('[data-total]', e).textContent = M8.price(total());
        $('[data-f="address"]', e).hidden = form.delivery === 'pickup';
        $('.sumrow:nth-last-child(2) span', e).textContent = 'Доставка · ' + dv().t;
        M8.main({ visible: true, text: `ОПЛАТИТЬ ${M8.price(total())}`, shine: true, fn: pay });
      };
      e.addEventListener('input', (ev) => { const n = ev.target.name; if (n) { form[n] = ev.target.value; ev.target.closest('.field').classList.remove('is-err'); } });
      e.addEventListener('click', async (ev) => {
        const d = ev.target.closest('[data-dv]');
        if (d) { form.delivery = d.dataset.dv; M8.haptic.select(); $$('.opt', e).forEach((o) => { const on = o.dataset.dv === form.delivery; o.classList.toggle('is-on', on); o.setAttribute('aria-checked', on); }); sync(); }
        if (ev.target.closest('[data-agree]')) {
          form.agree = !form.agree;
          const a = $('[data-agree]', e); a.classList.toggle('is-on', form.agree); a.classList.remove('is-err'); a.setAttribute('aria-checked', form.agree);
          const sig = $('[data-sig]', e);
          if (form.agree) {
            sig.setAttribute('d', M8.signPath(M8.user.username || M8.user.id, 240, 62));
            const len = sig.getTotalLength(); sig.style.strokeDasharray = len; sig.style.strokeDashoffset = len;
            M8.haptic.impact('soft');
            M8.anim(sig, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
          } else sig.setAttribute('d', '');
        }
        if (ev.target.closest('[data-contact]')) {
          ev.preventDefault();
          M8.haptic.impact('light');
          const ph = await M8.requestContact();
          if (ph) { form.phone = ph; const i = $('input[name=phone]', e); i.value = ph; i.closest('.field').classList.remove('is-err'); M8.toast('НОМЕР ПОЛУЧЕН ИЗ TELEGRAM'); }
        }
      });
      const pay = () => {
        const bad = [];
        if (form.name.trim().length < 3) bad.push('name');
        if (form.phone.replace(/\D/g, '').length < 10) bad.push('phone');
        if (form.delivery !== 'pickup' && form.address.trim().length < 6) bad.push('address');
        bad.forEach((k) => { const f = $(`[data-f="${k}"]`, e); f.classList.add('is-err'); M8.shake(f, 5); });
        if (!form.agree) { $('[data-agree]', e).classList.add('is-err'); bad.push('agree'); }
        if (bad.length) {
          M8.haptic.notify('error');
          const first = $(bad[0] === 'agree' ? '[data-agree]' : `[data-f="${bad[0]}"]`, e);
          first && first.scrollIntoView({ behavior: M8.reduced ? 'auto' : 'smooth', block: 'center' });
          M8.toast('ПРОТОКОЛ НЕ ЗАПОЛНЕН');
          return;
        }
        M8.main({ progress: true });
        // production: POST /api/orders {cart, protocol} -> server prices from DB, reserves stock 15 min, createInvoiceLink
        setTimeout(() => {
          M8.main({ progress: false });
          M8.openInvoice('https://t.me/$demo-invoice', (status) => {
            if (status === 'paid') {
              const no = 'MRK-' + M8.pad(123 + S().orders.length, 6);
              const order = { no, at: Date.now(), items: S().cart.map((c) => ({ ...c })), delivery: form.delivery, total: total(), name: form.name, status: 0, track: '' };
              M8.set((s) => ({ orders: [order, ...s.orders], cart: [] }));
              go('#/booked/' + no, { replace: true });
            } else if (status === 'cancelled') M8.toast('ОФОРМЛЕНИЕ ПРЕРВАНО СУБЪЕКТОМ');
            else if (status === 'failed') { M8.haptic.notify('error'); M8.toast('ПЛАТЁЖ ОТКЛОНЁН'); }
          });
        }, 650);
      };
      sync();
      return () => {};
    },
  };

  /* emulated Telegram payment form (only outside Telegram) */
  M8.emuInvoice = (cb) => {
    const items = S().cart.map((c) => { const p = M8.product(c.id); return `<div class="sheet__item">${p.photo ? `<img src="${M8.img(p, 'front', 360)}" alt="">` : ''}<div><b>${M8.esc(p.title)}</b><span>Размер ${c.size} · ×${c.qty} · MRAK8</span></div></div>`; }).join('');
    const dv = M8.DELIVERY.find((d) => d.k === form.delivery);
    const total = cartTotal() + dv.p;
    const bg = el('<div class="sheet-bg"></div>');
    const sh = el(`<div class="sheet" role="dialog" aria-label="Оплата"><div class="sheet__grab"></div>
      <div class="sheet__h"><span>Оплата</span><button type="button" data-x>Отмена</button></div>
      <div class="sheet__emu">ЭМУЛЯЦИЯ ПЛАТЁЖНОЙ ФОРМЫ TELEGRAM · В ПРОДЕ ЕЁ РИСУЕТ САМ TELEGRAM (openInvoice)</div>
      ${items}
      <div class="sheet__row"><span>Способ оплаты</span><span>ЮKassa · тестовая карта</span></div>
      <div class="sheet__row"><span>Доставка</span><span>${dv.t} · ${dv.p} ₽</span></div>
      <div class="sheet__row"><span>Итого</span><span><b>${M8.price(total)}</b></span></div>
      <button class="sheet__pay" type="button">Оплатить ${M8.price(total)}</button></div>`);
    document.body.append(bg, sh);
    M8.anim(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' });
    M8.anim(sh, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 340, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    const close = async (status) => {
      M8.anim(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      await M8.done(M8.anim(sh, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 260, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), 360);
      bg.remove(); sh.remove(); cb(status);
    };
    bg.onclick = () => close('cancelled');
    $('[data-x]', sh).onclick = () => close('cancelled');
    $('.sheet__pay', sh).onclick = async (ev) => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Обработка…';
      await M8.wait(1100);
      close('paid');
    };
  };

  /* ============================================================== BOOKED */
  screens.booked = {
    tab: 'dossier', parent: '#/dossier',
    render({ no }) {
      const o = S().orders.find((x) => x.no === no) || S().orders[0] || demoOrder();
      const lines = o.items.map((c, i) => { const p = M8.product(c.id); return `<div>${M8.pad(i + 1)} ${M8.esc(p.title)}</div><div class="ln"><span>&nbsp;&nbsp; ${c.size} × ${c.qty}</span><i></i><span>${M8.price(p.price * c.qty)}</span></div>`; }).join('');
      const dv = M8.DELIVERY.find((d) => d.k === o.delivery) || M8.DELIVERY[0];
      const d = new Date(o.at);
      const link = `https://t.me/mrak8_bot/shop?startapp=order_${o.no}`;
      return el(`<section class="screen" aria-label="Оформлен"><div class="booked">
        <div class="booked__case"><h1 class="display">Оформлен</h1><span class="label">CASE <b style="color:var(--mrak-cream)">#${o.no}</b></span></div>
        <div class="bform">
          <div class="form__top">${M8.logo()}<div class="form__no">ФОРМА № 8-ПРК · ЭКЗ. 2<br>CASE <b>#${o.no}</b></div></div>
          <h2>Протокол оформления</h2>
          <dl>
            <div class="kv"><dt>Субъект</dt><dd>#${M8.subject}</dd></div>
            <div class="kv"><dt>ФИО</dt><dd>${M8.esc(o.name || '—')}</dd></div>
            <div class="kv"><dt>Дата / время</dt><dd>${M8.date(d)} · ${M8.time(d)}</dd></div>
            <div class="kv"><dt>Этапирование</dt><dd>${dv.t}</dd></div>
            <div class="kv"><dt>Сумма</dt><dd>${M8.price(o.total)}</dd></div>
          </dl>
          <div class="mp" aria-hidden="true">М.П.</div>
        </div>
        <div class="receipt" aria-label="Квитанция"><div class="receipt__in">
          <div class="c">${M8.logo('lg')}</div>
          <div class="c">MRAK8 CENTRAL BOOKING &amp; INTAKE CENTER</div>
          <div class="c">КВИТАНЦИЯ ОБ ОФОРМЛЕНИИ</div>
          <div class="hr"></div>
          <div class="ln"><span>CASE</span><i></i><span>#${o.no}</span></div>
          <div class="ln"><span>SUBJECT</span><i></i><span>#${M8.subject}</span></div>
          <div class="ln"><span>ДАТА</span><i></i><span>${M8.date(d)} ${M8.time(d)}</span></div>
          <div class="hr"></div>
          ${lines}
          <div class="ln"><span>ДОСТАВКА · ${dv.t.toUpperCase()}</span><i></i><span>${M8.price(dv.p)}</span></div>
          <div class="hr"></div>
          <div class="ln tot"><span>ИТОГО</span><i></i><span>${M8.price(o.total)}</span></div>
          <div class="ln"><span>ОПЛАЧЕНО</span><i></i><span>ЮKASSA · ТЕСТ</span></div>
          <div class="ln"><span>ЧЕК 54-ФЗ</span><i></i><span>ОТПРАВЛЕН</span></div>
          <div class="qr">${M8.qr(link)}</div>
          <div class="c" style="font-size:9px">СКАНИРУЙ — ДЕЛО ОТКРОЕТСЯ В TELEGRAM</div>
          <div class="hr"></div>
          <div class="c">NO EMOTIONAL CONTRABAND.<br>ALL SUBJECTS ARE MONITORED.</div>
        </div></div>
      </div></section>`);
    },
    mount(e, { no }) {
      const o = S().orders.find((x) => x.no === no) || S().orders[0] || demoOrder();
      const bform = $('.bform', e);
      (async () => {
        M8.anim(e, [{ background: '#000' }, { background: 'transparent' }], { duration: 500 });
        await M8.done(M8.anim(bform, [{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }), 520);
        await M8.slam(bform, 'ОФОРМЛЕН', { sub: `CASE #${o.no} · ${M8.date()}`, rot: -11, haptic: 'success', cls: 'stamp--paper', w: 320, h: 104 });
        const lines = $$('.receipt__in > *', e);
        for (const [i, n] of lines.entries()) {
          M8.anim(n, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 180, delay: i * 45, fill: 'forwards', easing: 'steps(3)' });
        }
        if (M8.reduced) lines.forEach((n) => (n.style.opacity = 1));
      })();
      M8.main({ visible: true, text: 'ПОДЕЛИТЬСЯ: «Я ОФОРМЛЕН»', shine: true, fn: () => sharePreview(o) });
      M8.secondary({ visible: true, text: 'В КАТАЛОГ', position: 'left', fn: () => go('#/') });
      return () => {};
    },
  };
  function demoOrder() { return { no: 'MRK-000123', at: Date.now(), items: [{ id: '001', size: 'L', qty: 1 }], delivery: 'cdek', total: 7290, name: [M8.user.first_name, M8.user.last_name].join(' '), status: 0, track: '' }; }

  function sharePreview(o) {
    M8.haptic.impact('light');
    const sh = el(`<div class="share" role="dialog" aria-label="Поделиться"><div class="share__card">
      <div class="share__emu">ПРЕДПРОСМОТР · shareMessage(prepared_message_id) — сообщение собирает бот</div>
      <div class="msg"><div class="msg__img">
        <div class="hchart" style="color:#F1ECE1">${M8.hchart({ from: 150, to: 200, strong: 0.22, weak: 0.08 })}</div>
        <div style="position:absolute;left:12px;top:12px;width:84px;color:#fff">${M8.logo()}</div>
        <div style="position:absolute;right:12px;top:12px;text-align:right;font:600 9px/1.4 var(--font-mono);letter-spacing:.08em;color:#8A8680">SUBJECT<br><b style="color:#F1ECE1;font-size:13px">#${M8.subject}</b></div>
        <div style="position:absolute;left:12px;bottom:12px;font:900 34px/.85 var(--font-display);color:#F1ECE1;text-transform:uppercase">Я оформлен<br>в MRAK8</div>
        <div style="position:absolute;right:8px;bottom:18px;width:52%;color:#E0241B;transform:rotate(-12deg)">${M8.stampSVG('ОФОРМЛЕН', 'CASE #' + o.no, { w: 300, h: 100 })}</div>
      </div><div class="msg__txt">Меня оформили в MRAK8 Central Booking. Дело #${o.no}. NO EMOTIONAL CONTRABAND.</div><div class="msg__btn">ОТКРЫТЬ ДЕЛО ↗</div></div>
      <div class="share__acts"><button type="button" data-a="msg">Отправить другу</button><button type="button" data-a="story">В историю</button></div>
    </div></div>`);
    document.body.appendChild(sh);
    M8.anim($('.share__card', sh), [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
    sh.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-a]');
      if (a) { M8.haptic.notify('success'); M8.toast(a.dataset.a === 'msg' ? 'TELEGRAM: shareMessage — выбор чата' : 'TELEGRAM: shareToStory — редактор истории'); sh.remove(); }
      else if (!ev.target.closest('.share__card')) sh.remove();
    });
  }

  /* ============================================================= DOSSIER */
  screens.dossier = {
    root: true, tab: 'dossier', camLabel: 'DOSSIER',
    render() { return el('<section class="screen dos" aria-label="Досье"></section>'); },
    mount(e) {
      const past = { no: 'MRK-000097', at: Date.now() - 6 * 864e5, items: [{ id: '003', size: 'OS', qty: 1 }], delivery: 'post', total: 3190, status: 2, track: '80086431129472' };
      const list = [...S().orders, past];
      e.innerHTML = `<div class="scr-h"><div><span class="label">ДОСЬЕ СУБЪЕКТА #${M8.subject}</span><h1 class="display">Мои дела</h1></div><span class="label">ДЕЛ: <b style="color:var(--mrak-cream)">${list.length}</b></span></div>
        ${list.map((o) => {
          const it = o.items[0]; const p = M8.product(it.id);
          const ph = p.photo ? `<img src="${M8.img(p, 'front', 360)}" alt="">` : M8.flat(p.flat);
          return `<article class="dcase"><div class="dcase__h"><b>CASE #${o.no}</b><span class="label">${M8.date(new Date(o.at))}</span></div>
            <div class="dcase__body"><span class="frow__ph">${ph}</span><span class="frow__t"><h3 style="font:800 16px/1 var(--font-display);text-transform:uppercase;margin:0">${M8.esc(p.title)}</h3><span class="label">${it.size} × ${it.qty}${o.items.length > 1 ? ` · +${o.items.length - 1}` : ''}</span></span><span class="price" style="font-size:13px">${M8.price(o.total)}</span></div>
            <div class="steps">${M8.STEPS.map((s, i) => `<div class="step ${i < o.status ? 'is-done' : i === o.status ? 'is-now' : ''}">${s}</div>`).join('')}</div>
            ${o.track ? `<button class="track-no" type="button" data-copy="${o.track}"><span>ТРЕК</span>${o.track}<span>КОПИРОВАТЬ</span></button>` : `<div class="label" style="padding:0 12px 12px">ТРЕК-НОМЕР ПРИДЁТ ОТ БОТА ПРИ ЭТАПИРОВАНИИ</div>`}
          </article>`;
        }).join('')}
        <p class="label" style="text-align:center;margin-top:18px">ПРИНЯТ → СОБРАН → ЭТАПИРОВАН → ДОСТАВЛЕН</p>`;
      e.onclick = (ev) => {
        const c = ev.target.closest('[data-copy]');
        if (!c) return;
        try { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy); } catch (er) {}
        M8.haptic.notify('success'); M8.toast('ТРЕК СКОПИРОВАН');
      };
      return () => {};
    },
  };

  /* ================================================================ LOST */
  screens.lost = {
    tab: null, parent: '#/',
    render() {
      return el(`<section class="screen"><div class="lost"><canvas width="90" height="160" aria-hidden="true"></canvas>
        <span class="lost__sig">● NO SIGNAL · CAM_08</span>
        <h1 class="display">Связь с центром потеряна</h1>
        <p>Проверьте сеть. Дело не пострадало:<br>пакет сохранён в CloudStorage.</p>
        <button class="btn" type="button" data-retry>Повторить</button></div></section>`);
    },
    mount(e) {
      const c = $('canvas', e), g = c.getContext('2d'), img = g.createImageData(c.width, c.height);
      let on = true, t = 0;
      const draw = () => {
        if (!on) return;
        if (++t % 3 === 0) {
          for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
          g.putImageData(img, 0, 0);
          const y = (t * 2) % c.height; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, y, c.width, 10);
        }
        requestAnimationFrame(draw);
      };
      if (!M8.reduced) draw();
      M8.haptic.notify('error');
      $('[data-retry]', e).onclick = async (ev) => {
        const b = ev.currentTarget; b.textContent = 'СОЕДИНЕНИЕ…'; M8.haptic.impact('light');
        await M8.wait(900); go('#/', { replace: true });
      };
      return () => { on = false; };
    },
  };

  /* ============================================================== SPLASH */
  async function splash({ short = false } = {}) {
    const u = M8.user;
    const avatar = u.photo_url ? `<img class="mug__img" src="${M8.esc(u.photo_url)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;bottom:auto;top:0">` : `<div class="mug__img">${silhouette}</div>`;
    const s = el(`<div class="splash" role="dialog" aria-label="Оформление субъекта">
      <div class="splash__corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="splash__osd" aria-hidden="true"><span class="rec"><i class="dot"></i>REC · CAM_08 · INTAKE</span><time data-clock="tc"></time></div>
      <div class="splash__logo">${M8.logoLayers()}</div>
      <div class="splash__mug" aria-hidden="true"><div class="mug"><div class="mug__chart hchart" style="color:#F1ECE1">${M8.hchart({ from: 150, to: 200, minor: 2, major: 10, label: 10, strong: 0.35, weak: 0.12 })}${chartLabels(160, 190, 10)}</div>${avatar}
        <div class="mug__lock"><i></i><i></i><i></i><i></i></div>
        <div class="mug__board"><span>MRAK8 CENTRAL BOOKING</span><b>#${M8.subject}</b><span>${M8.date()}</span></div><div class="mug__scan"></div></div></div>
      <div class="splash__term" aria-live="polite"><p></p><p></p><p></p></div>
      <div class="splash__skip">ТАП — ПРОПУСТИТЬ ОФОРМЛЕНИЕ</div>
      <div class="splash__scan" aria-hidden="true"></div>
    </div>`);
    document.body.appendChild(s);
    M8.tick();
    let skip = false, resolveSkip;
    const skipP = new Promise((r) => (resolveSkip = r));
    s.addEventListener('click', () => { skip = true; resolveSkip(); });
    const W = (ms) => Promise.race([M8.wait(ms), skipP]);
    const rt = $('.ring--t', s), rb = $('.ring--b', s), letters = $$('.l-letter', s), terms = $$('.splash__term p', s), mug = $('.splash__mug', s);
    const name = u.username ? '@' + u.username : (u.first_name || 'SUBJECT');
    const run = async () => {
      if (short) {
        M8.anim(rt, [{ transform: 'rotateY(-180deg)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
        M8.anim(rb, [{ transform: 'rotateX(180deg)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
        mug.style.display = 'none';
        terms[0].innerHTML = `&gt; SUBJECT <b>#${M8.subject}</b> — <span class="ok">С ВОЗВРАЩЕНИЕМ</span>`;
        await W(400);
        return;
      }
      M8.anim(rb, [{ transform: 'scale(0) rotateX(-560deg) rotateY(40deg)' }, { transform: 'scale(1.04) rotateX(-10deg)', offset: 0.75 }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      M8.anim(rt, [{ transform: 'scale(0) rotateY(-620deg) rotateX(60deg)' }, { transform: 'scale(1.05) rotateY(8deg)', offset: 0.75 }, { transform: 'none' }], { duration: 960, delay: 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      letters.forEach((l, i) => M8.anim(l, [
        { transform: 'translateY(-170%)', opacity: 1 },
        { transform: 'translateY(0)', offset: 0.68 },
        { transform: 'translateY(-5%) scaleY(1.02)', offset: 0.84 },
        { transform: 'translateY(0)' },
      ], { duration: 560, delay: 170 + i * 70, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'backwards' }));
      await W(170 + 3 * 70 + 380);
      M8.haptic.impact('rigid');
      M8.shake(s, 3);
      M8.anim($('.splash__scan', s), [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 1, transform: `translateY(${innerHeight}px)` }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' });
      await W(120);
      M8.anim(mug, [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'steps(4)', fill: 'forwards' });
      M8.anim($('.mug__scan', s), [{ transform: 'translateY(0)' }, { transform: 'translateY(440%)' }], { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)' });
      M8.anim($('.mug__lock', s), [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.5 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, delay: 300, easing: 'steps(3)', fill: 'backwards' });
      await M8.type(terms[0], '&gt; SCANNING SUBJECT…', 95);
      if (skip) return;
      await W(120);
      await M8.type(terms[1], `&gt; <b>${M8.esc(name)}</b> IDENTIFIED`, 95);
      if (skip) return;
      await W(90);
      await M8.type(terms[2], `&gt; SUBJECT <b>#${M8.subject}</b> — <span class="ok">ДОСТУП РАЗРЕШЁН</span>`, 110);
      M8.haptic.notify('success');
      await W(420);
    };
    await Promise.race([run(), skipP]);
    s.classList.add('is-out');
    await M8.done(M8.anim(s, [
      { transform: 'scale(1,1)', filter: 'brightness(1)', opacity: 1 },
      { transform: 'scale(1,.006)', filter: 'brightness(2.5)', opacity: 1, offset: 0.55 },
      { transform: 'scale(0,.006)', filter: 'brightness(3)', opacity: 0 },
    ], { duration: 360, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), 460);
    s.remove();
  }
  M8.splash = splash;

  /* ================================================================ BOOT */
  async function boot() {
    M8.tgInit();
    await M8.restore();
    const st = M8.q.get('state');
    if (st === 'empty') M8.state.cart = [];
    if (st === 'filled' && !M8.state.cart.length) M8.state.cart = [{ id: '001', size: 'L', qty: 1 }];
    buildShell(document.getElementById('root'));
    // deep links: startapp=product_<id> | drop_<id> | order_<no>
    const sp = M8.startParam;
    let start = location.hash && location.hash.startsWith('#/') ? location.hash : '#/';
    if (/^product_/.test(sp)) start = '#/case/' + sp.slice(8);
    else if (/^drop_/.test(sp)) start = '#/case/' + sp.slice(5);
    else if (/^order_/.test(sp)) start = '#/dossier';
    else if (sp === 'admin') start = '#/admin';
    if (start !== '#/' && !screens[parse(start).name].root) stack.push('#/');
    go(start);
    const showSplash = M8.q.get('splash') !== '0';
    if (showSplash) await splash({ short: S().visits > 0 && M8.q.get('splash') !== 'full' });
    M8.set((s) => ({ visits: s.visits + 1 }));
  }

  // manual hash edits (and the concept board) navigate too; our own replaceState never fires hashchange
  addEventListener('hashchange', () => { if (location.hash.startsWith('#/') && (!cur || cur.path !== location.hash)) go(location.hash); });

  // concept board remote control
  addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.m8 === 'go') {
      if (d.state === 'empty') M8.set({ cart: [] });
      if (d.state === 'filled' && !S().cart.length) M8.set({ cart: [{ id: '001', size: 'L', qty: 1 }] });
      if (d.view) { M8.set({ view: d.view, filter: 'all' }); const c = screens.catalog._el; if (c && c._draw) c._draw(false); }
      go(d.path, { replace: true });
      if (d.scrollTo) setTimeout(() => { const n = $(d.scrollTo); n && n.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
    }
    if (d.m8 === 'splash') splash({ short: false });
    if (d.m8 === 'class') document.documentElement.classList.toggle(d.cls, d.on);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
