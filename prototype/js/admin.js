/* MRAK8 prototype — CONTROL ROOM (admin). In production: route guarded on the server by ADMIN_IDS + initData HMAC. */
(function () {
  'use strict';
  const { el, $, $$ } = M8;
  const A = M8.admin;
  const ST = { draft: 'ЧЕРНОВИК', drop: 'ДРОП СКОРО', live: 'В ПРОДАЖЕ', soldout: 'SOLD OUT', archive: 'АРХИВ' };
  const stCls = { live: 'st--live', drop: 'st--drop', soldout: 'st--out' };
  const ORDER_ST = ['ОЖИДАЕТ ОПЛАТЫ', 'ПРИНЯТ', 'СОБРАН', 'ЭТАПИРОВАН', 'ДОСТАВЛЕН', 'ОТМЕНЁН'];

  const spark = (vals, { bars = false } = {}) => {
    const max = Math.max(...vals) || 1, n = vals.length;
    if (bars) return `<svg class="spark" viewBox="0 0 ${n * 10} 40" preserveAspectRatio="none">${vals.map((v, i) => `<rect x="${i * 10 + 2}" y="${40 - (v / max) * 38}" width="6" height="${(v / max) * 38}" fill="${i === n - 1 ? '#E0241B' : '#8A8680'}" fill-opacity="${i === n - 1 ? 1 : 0.5}"/>`).join('')}</svg>`;
    const pts = vals.map((v, i) => `${(i / (n - 1)) * 100},${40 - (v / max) * 36}`).join(' ');
    return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#E0241B" stroke-width="1.5" vector-effect="non-scaling-stroke"/><polyline points="0,40 ${pts} 100,40" fill="#E0241B" fill-opacity=".08" stroke="none"/></svg>`;
  };
  const mon = (cam, label, body, cls = '') => `<div class="mon ${cls}"><div class="mon__h"><span>${cam} · ${label}</span><span class="rec"><i class="dot"></i>REC</span></div>${body}</div>`;

  M8.screens.admin = {
    root: true, tab: null, camLabel: 'CONTROL ROOM',
    render({ tab }) {
      const p1 = M8.products[0];
      const low = M8.products.flatMap((p) => p.sizes.filter((s) => s.stock > 0 && s.stock <= 3).map((s) => ({ p, s })));
      const week = A.revenueWeek.reduce((a, b) => a + b, 0);
      return el(`<section class="screen" aria-label="Control room"><div class="ctrl">
        <div class="ctrl__h"><div><span class="label">ПУЛЬТ ДЕЖУРНОГО · OP #${M8.subject} · <b>● LIVE</b></span><h1 class="display">Control room</h1></div><span class="label" data-clock>—</span></div>
        <div class="wall">
          ${mon('CAM_01', 'ВЫРУЧКА · СЕГОДНЯ', `${spark(A.hours)}<div class="mon__v">${M8.price(A.revenueToday)}</div><div class="mon__s up">+12% К ВЧЕРА</div>`)}
          ${mon('CAM_02', 'ВЫРУЧКА · 7 ДНЕЙ', `${spark(A.revenueWeek, { bars: true })}<div class="mon__v">${M8.price(week)}</div><div class="mon__s">ПН–ВС</div>`)}
          ${mon('CAM_03', 'ЗАКАЗЫ', `<div class="mon__v">${A.newOrders}<small>НОВЫХ</small></div><div class="mon__s dn">● ${A.waiting} ЖДУТ СБОРКИ</div>`)}
          ${mon('CAM_04', 'СРЕДНИЙ ЧЕК', `<div class="mon__v">${M8.price(A.avg)}</div><div class="mon__s">КОНВЕРСИЯ 4,8%</div>`)}
          ${mon('CAM_05', 'ТОП ВЕЩДОК', `<img class="mon__img" src="${M8.img(p1, 'front', 360)}" alt=""><div class="mon__v" style="position:relative">#001<small>41 ШТ</small></div><div class="mon__s" style="position:relative">ZIP-HOODIE</div>`)}
          ${mon('CAM_06', 'ОСТАТКИ НА ИСХОДЕ', `<div class="mon__low">${low.map(({ p, s }) => `<div><span>#${p.no} / ${s.s}</span><b>${s.stock} ШТ</b></div>`).join('') || '<div>ВСЁ В НОРМЕ</div>'}</div>`)}
        </div>
        <div class="atabs" role="tablist">${[['products', 'ТОВАРЫ'], ['orders', 'ЗАКАЗЫ'], ['drops', 'ДРОПЫ'], ['channel', 'КАНАЛ']].map(([k, t]) => `<button role="tab" data-at="${k}" class="${k === tab ? 'is-on' : ''}">${t}</button>`).join('')}</div>
        <div class="apane"></div>
      </div></section>`);
    },
    mount(e, { tab }) {
      const pane = $('.apane', e);
      let filter = 'ВСЕ';
      const draw = (t) => {
        tab = t;
        $$('.atabs button', e).forEach((b) => b.classList.toggle('is-on', b.dataset.at === t));
        if (t === 'products') {
          pane.innerHTML = `<div class="alist">${M8.products.map((p) => `<button class="arow" data-edit="${p.id}"><span class="frow__ph">${p.photo ? `<img src="${M8.img(p, 'front', 360)}" alt="">` : M8.flat(p.flat)}</span>
            <span><h3>#${p.no} · ${M8.esc(p.name)}</h3><p>${M8.price(p.price)} · ОСТ. ${M8.stockOf(p)} · ${p.sizes.map((s) => s.s + s.stock).join(' ')}</p></span><span class="st ${stCls[p.status] || ''}">${ST[p.status]}</span></button>`).join('')}
            <button class="arow" data-edit="004"><span class="frow__ph" style="display:grid;place-items:center;font:800 14px var(--font-display);color:var(--mrak-grey)">#004</span><span><h3>#004 · ЛОНГСЛИВ «INTAKE»</h3><p>НЕ ЗАПОЛНЕН · СКРЫТ ИЗ КАТАЛОГА</p></span><span class="st">ЧЕРНОВИК</span></button></div>
            <button class="btn anew" data-edit="new">+ Новый вещдок</button>`;
        } else if (t === 'orders') {
          const list = A.orders.filter((o) => filter === 'ВСЕ' || o.status === filter);
          pane.innerHTML = `<div class="chips" style="padding:12px 2px">${['ВСЕ', ...ORDER_ST].map((s) => `<button class="chip ${s === filter ? 'is-on' : ''}" data-of="${s}">${s}</button>`).join('')}</div>
            ${list.map((o) => `<div class="orow"><div><b>CASE #${o.no}</b><p>#${o.subject} · ${M8.esc(o.name)} · ${o.at}<br>${o.items} · ${M8.price(o.sum)}</p></div>
              <select data-os="${o.no}" aria-label="Статус">${ORDER_ST.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
              <div class="trk"><input value="${o.track}" placeholder="ТРЕК-НОМЕР СДЭК / ПОЧТЫ" data-trk="${o.no}" inputmode="numeric"><button data-send="${o.no}">ОТПРАВИТЬ<br>СУБЪЕКТУ</button></div></div>`).join('') || '<p class="label" style="padding:20px 6px">ДЕЛ С ТАКИМ СТАТУСОМ НЕТ</p>'}
            <button class="btn btn--ghost anew" data-csv>Экспорт CSV</button>`;
        } else if (t === 'drops') {
          const d = M8.products.filter((p) => p.status === 'drop');
          pane.innerHTML = `<div class="alist">${d.map((p) => `<div class="arow" style="grid-template-columns:48px 1fr"><span class="frow__ph">${M8.flat(p.flat)}</span><span><h3>#${p.no} · ${M8.esc(p.name)}</h3><p>ВЫХОД ${M8.date(new Date(p.dropAt))} 20:00 МСК · НА НАБЛЮДЕНИИ: 214</p><div style="margin-top:8px">${countMini(p.dropAt)}</div></span></div>`).join('')}</div>
            <div class="ed__sec"><h2>Запланировать дроп</h2><div class="af2"><label class="af"><span>Вещдок</span><select><option>#004 · ЛОНГСЛИВ «INTAKE»</option><option>#002 · ФУТБОЛКА</option></select></label><label class="af"><span>Дата и время (МСК)</span><input type="datetime-local" value="2026-10-31T20:00"></label></div>
            <button class="btn btn--block" data-plan>Запланировать · бот разошлёт уведомления</button></div>`;
        } else {
          const p = M8.products[0];
          pane.innerHTML = `<div class="ed__sec" style="border:0;margin-top:8px"><h2>Пост в канал <span>CHANNEL_ID · @mrak8</span></h2>
            <div class="post"><div class="post__img"><img src="${M8.img(p, 'front', 720)}" alt=""></div>
            <p style="margin:8px 2px">🟥 ВЕЩДОК #001 — ZIP-HOODIE «НЕ ДИЗАЙНЕР»<br>Партия 1/50. ${M8.price(p.price)}<br>NO EMOTIONAL CONTRABAND.</p>
            <div class="post__btn">ОТКРЫТЬ ДЕЛО #001 ↗</div></div>
            <p class="label" style="margin:10px 0">КНОПКА ВЕДЁТ В МИНИ-АПП: startapp=product_001</p>
            <button class="btn btn--red btn--block" data-publish>Анонсировать в канале</button></div>`;
        }
      };
      e.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-at]'); if (t) { M8.haptic.select(); draw(t.dataset.at); return; }
        const ed = ev.target.closest('[data-edit]'); if (ed) { M8.haptic.impact('light'); M8.go('#/admin/p/' + ed.dataset.edit); return; }
        const of = ev.target.closest('[data-of]'); if (of) { filter = of.dataset.of; M8.haptic.select(); draw('orders'); return; }
        const sd = ev.target.closest('[data-send]');
        if (sd) { const inp = $(`[data-trk="${sd.dataset.send}"]`, e); if (!inp.value.trim()) { M8.haptic.notify('error'); M8.toast('ВВЕДИТЕ ТРЕК-НОМЕР'); return; } M8.haptic.notify('success'); M8.toast('БОТ ОТПРАВИЛ ТРЕК СУБЪЕКТУ'); return; }
        if (ev.target.closest('[data-csv]')) { exportCSV(); return; }
        if (ev.target.closest('[data-plan]')) { M8.haptic.notify('success'); M8.toast('ДРОП ЗАПЛАНИРОВАН · 31.10 20:00'); return; }
        if (ev.target.closest('[data-publish]')) { M8.haptic.notify('success'); M8.toast('ПОСТ ОПУБЛИКОВАН В КАНАЛЕ'); }
      });
      e.addEventListener('change', (ev) => {
        const s = ev.target.closest('[data-os]');
        if (s) { const o = A.orders.find((x) => x.no === s.dataset.os); o.status = s.value; M8.haptic.select(); M8.toast(`CASE #${o.no} → ${s.value}`); }
      });
      draw(tab);
      return () => {};
    },
  };
  const countMini = (t) => { const d = Math.max(0, t - Date.now()); return `<span class="st st--drop">ЧЕРЕЗ ${Math.floor(d / 864e5)}Д ${M8.pad(Math.floor((d % 864e5) / 36e5))}Ч</span>`; };
  function exportCSV() {
    const rows = [['case', 'subject', 'name', 'items', 'sum', 'status', 'track', 'created'], ...A.orders.map((o) => [o.no, o.subject, o.name, o.items, o.sum, o.status, o.track, o.at])];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `mrak8-orders-${M8.date().replace(/\./g, '-')}.csv`;
    a.click();
    M8.toast('CSV СФОРМИРОВАН');
  }

  /* product editor */
  M8.screens.editor = {
    tab: null, parent: '#/admin',
    render({ id }) {
      const p = M8.product(id) || { id: 'new', no: '005', name: '', sub: '', title: '', cat: 'hoodie', price: 0, old: null, status: 'draft', batch: '1/50', sizes: [{ s: 'S', stock: 0, h: [163, 171], m: [0, 0, 0] }, { s: 'M', stock: 0, h: [171, 179], m: [0, 0, 0] }, { s: 'L', stock: 0, h: [179, 187], m: [0, 0, 0] }], proto: [] };
      const slot = (k, label, src) => `<label class="slot" data-slot="${k}"><span class="slot__l">${label}</span>${src ? `<img class="contain" src="${src}" alt="">` : '<span class="slot__plus"><b>+</b>ПЕРЕТАЩИ<br>ИЛИ ВЫБЕРИ</span>'}<input type="file" accept="image/*"></label>`;
      return el(`<section class="screen" aria-label="Редактор вещдока"><div class="ctrl ed">
        <div class="ctrl__h"><div><span class="label">CONTROL ROOM · ${id === 'new' ? 'НОВЫЙ ВЕЩДОК' : 'ДЕЛО #' + p.no}</span><h1 class="display">${id === 'new' ? 'Новый вещдок' : 'Вещдок #' + p.no}</h1></div><span class="st ${stCls[p.status] || ''}" data-stbadge>${ST[p.status]}</span></div>
        <div class="ed__sec"><h2>Основное</h2>
          <label class="af"><span>Название</span><input value="${M8.esc(p.title)}" placeholder="ZIP-HOODIE «...»"></label>
          <div class="af2"><label class="af"><span>Slug</span><input value="${M8.esc(p.slug || '')}" placeholder="zip-hoodie-..."></label><label class="af"><span>Номер вещдока</span><input value="#${p.no}"></label></div>
          <div class="af2"><label class="af"><span>Категория</span><select>${M8.CATS.filter((c) => c.k !== 'all' && c.k !== 'archive').map((c) => `<option ${c.k === p.cat ? 'selected' : ''}>${c.t}</option>`).join('')}</select></label><label class="af"><span>Партия</span><input value="${p.batch}"></label></div>
          <div class="af2"><label class="af"><span>Цена, ₽</span><input inputmode="numeric" value="${p.price || ''}"></label><label class="af"><span>Старая цена, ₽</span><input inputmode="numeric" value="${p.old || ''}" placeholder="—"></label></div>
        </div>
        <div class="ed__sec"><h2>Фото <span class="seg" role="group"><button class="is-on" data-crop="45">4:5</button><button data-crop="11">1:1</button></span></h2>
          <div class="slots">${slot('front', 'ФАС', p.photo ? M8.img(p, 'front', 360) : '')}${slot('back', 'СПИНА', p.photo ? M8.img(p, 'back', 360) : '')}${slot('d1', 'ДЕТАЛЬ 1', '')}</div>
          <p class="label" style="margin-top:8px">СЕРВЕР: SHARP → WEBP/AVIF 360/720/1200/2400 + LQIP → S3</p>
        </div>
        <div class="ed__sec"><h2>Размеры, остатки, ростомер</h2>
          <table class="stbl"><thead><tr><th>РАЗМЕР</th><th>ОСТАТОК</th><th>РОСТ ОТ</th><th>РОСТ ДО</th></tr></thead><tbody>
          ${p.sizes.map((s, i) => `<tr><td>${s.s}</td><td><span class="stp"><button data-st="${i}:-1">−</button><output class="${s.stock ? '' : 'is-zero'}" data-sto="${i}">${s.stock}</output><button data-st="${i}:1">+</button></span></td><td><input value="${s.h[0]}" inputmode="numeric"></td><td><input value="${s.h[1]}" inputmode="numeric"></td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="ed__sec"><h2>Замеры, см</h2>
          <table class="stbl"><thead><tr><th>РАЗМЕР</th><th>ДЛИНА</th><th>ШИРИНА</th><th>РУКАВ</th></tr></thead><tbody>
          ${p.sizes.map((s) => `<tr><td>${s.s}</td>${s.m.map((v) => `<td><input value="${v || ''}" inputmode="numeric"></td>`).join('')}</tr>`).join('')}
          </tbody></table>
        </div>
        <div class="ed__sec"><h2>Статус</h2>
          <div class="seg" data-status>${Object.entries(ST).map(([k, t]) => `<button data-s="${k}" class="${k === p.status ? 'is-on' : ''}">${t}</button>`).join('')}</div>
          <label class="af" data-dropat style="margin-top:10px" ${p.status === 'drop' ? '' : 'hidden'}><span>Выход дропа (МСК)</span><input type="datetime-local" value="2026-10-24T20:00"></label>
        </div>
        <div class="ed__sec"><h2>Протокол осмотра (описание)</h2>
          ${(p.proto.length ? p.proto : [['МАТЕРИАЛ', ''], ['ПОСАДКА', '']]).map(([k, v]) => `<div class="af2"><label class="af"><span>Поле</span><input value="${k}"></label><label class="af"><span>Значение</span><input value="${M8.esc(v)}"></label></div>`).join('')}
        </div>
      </div></section>`);
    },
    mount(e, { id }) {
      const p = M8.product(id);
      e.addEventListener('click', (ev) => {
        const c = ev.target.closest('[data-crop]');
        if (c) { ev.preventDefault(); $$('[data-crop]', e).forEach((b) => b.classList.toggle('is-on', b === c)); $$('.slot', e).forEach((s) => s.classList.toggle('is-1x1', c.dataset.crop === '11')); M8.haptic.select(); return; }
        const s = ev.target.closest('[data-s]');
        if (s && s.closest('[data-status]')) { $$('[data-status] button', e).forEach((b) => b.classList.toggle('is-on', b === s)); $('[data-dropat]', e).hidden = s.dataset.s !== 'drop'; const bd = $('[data-stbadge]', e); bd.textContent = ST[s.dataset.s]; bd.className = 'st ' + (stCls[s.dataset.s] || ''); M8.haptic.select(); return; }
        const st = ev.target.closest('[data-st]');
        if (st) { const [i, d] = st.dataset.st.split(':').map(Number); const o = $(`[data-sto="${i}"]`, e); const v = Math.max(0, +o.textContent + d); o.textContent = v; o.classList.toggle('is-zero', !v); M8.haptic.select(); }
      });
      $$('.slot', e).forEach((slot) => {
        const input = $('input', slot);
        const show = (file) => { if (!file) return; const url = URL.createObjectURL(file); slot.querySelectorAll('img, .slot__plus').forEach((n) => n.remove()); slot.insertBefore(el(`<img src="${url}" alt="">`), input); M8.haptic.notify('success'); M8.toast('ФОТО ПРИНЯТО · ОБРАБОТКА НА СЕРВЕРЕ'); };
        input.addEventListener('change', () => show(input.files[0]));
        slot.addEventListener('dragover', (ev) => { ev.preventDefault(); slot.classList.add('is-drag'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('is-drag'));
        slot.addEventListener('drop', (ev) => { ev.preventDefault(); slot.classList.remove('is-drag'); show(ev.dataTransfer.files[0]); });
      });
      M8.main({ visible: true, text: 'СОХРАНИТЬ ВЕЩДОК', color: '#E0241B', fn: () => { M8.haptic.notify('success'); M8.toast(`ВЕЩДОК #${p ? p.no : '005'} СОХРАНЁН`); } });
      M8.secondary({ visible: true, text: 'АНОНС В КАНАЛ', position: 'left', fn: () => M8.go('#/admin/channel') });
      return () => {};
    },
  };
})();
