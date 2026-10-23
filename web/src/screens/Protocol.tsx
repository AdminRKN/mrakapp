import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatRub, type ApiOrder, type CdekCity, type CdekMode, type CdekPoint, type CdekQuote } from '@mrak8/shared';
import { api, ApiError } from '../lib/api';
import { anim, done, reduced, shake, signPath, wait } from '../lib/fx';
import { go } from '../lib/router';
import { cartTotal, productById, set, toast, useStore } from '../lib/store';
import { distanceKm, formatKm, matchPoints } from '../lib/pointSearch';
import { getLocation, haptic, inTG, openInvoice, requestContact, tgUser } from '../lib/telegram';
import { Clock, imgUrl, Logo } from '../components/brand';
import { useMainButton } from '../components/useMainButton';

interface CdekState { city: CdekCity | null; mode: CdekMode; pvz: CdekPoint | null }
interface Form { name: string; phone: string; delivery: string; address: string; comment: string; agree: boolean; cdek: CdekState }
let draft: Form | null = null; // survives navigating away and back

const days = (q: CdekQuote) => (q.daysMin === q.daysMax ? `${q.daysMin} дн.` : `${q.daysMin}–${q.daysMax} дн.`);

/** СДЭК: the city as the subject types it, then a pickup point or a courier — prices are CDEK's own quotes */
function CdekPicker({ v, onChange, qty, onQuote, err }: { v: CdekState; onChange: (v: CdekState) => void; qty: number; onQuote: (q: CdekQuote | null) => void; err: boolean }) {
  const [q, setQ] = useState('');
  const [sug, setSug] = useState<CdekCity[]>([]);
  const [points, setPoints] = useState<CdekPoint[] | null>(null);
  const [pq, setPq] = useState('');
  const [near, setNear] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [quotes, setQuotes] = useState<Partial<Record<CdekMode, CdekQuote | null>>>({});
  const locate = async () => {
    haptic.impact('light');
    setLocating(true);
    const loc = await getLocation();
    setLocating(false);
    if (!loc) { toast('НЕТ ДОСТУПА К ГЕОПОЗИЦИИ — ВВЕДИТЕ УЛИЦУ ИЛИ МЕТРО'); return; }
    setNear(loc);
    const closest = Math.min(...(points ?? []).map((p) => distanceKm(loc, p)));
    toast(closest > 60 ? 'ВЫ ДАЛЕКО ОТ ЭТОГО ГОРОДА — СПИСОК ПО РАССТОЯНИЮ' : 'БЛИЖАЙШИЕ ПУНКТЫ — СВЕРХУ');
  };
  useEffect(() => {
    if (v.city || q.trim().length < 2) { setSug([]); return; }
    const t = setTimeout(() => api.cdekCities(q).then(setSug).catch(() => setSug([])), 300);
    return () => clearTimeout(t);
  }, [q, v.city]);
  useEffect(() => {
    if (!v.city) return;
    setPoints(null);
    setQuotes({});
    api.cdekPoints(v.city.code).then(setPoints).catch((e) => toast((e as Error).message));
    for (const m of ['pvz', 'door'] as const) api.cdekQuote(v.city.code, m, qty).then((r) => setQuotes((x) => ({ ...x, [m]: r }))).catch(() => setQuotes((x) => ({ ...x, [m]: null })));
  }, [v.city?.code, qty]);
  useEffect(() => { onQuote(v.city ? quotes[v.mode] ?? null : null); }, [quotes, v.mode, v.city?.code]);

  if (!v.city)
    return (
      <div className="cdek" data-f="cdek">
        <label className={`field ${err ? 'is-err' : ''}`}><span className="field__l">Город получения</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Начните вводить: Казань" autoComplete="address-level2" /><span className="field__err">ВЫБЕРИТЕ ГОРОД</span></label>
        {!!sug.length && <div className="cdek__sug">{sug.map((c) => <button key={c.code} type="button" onClick={() => { haptic.select(); onChange({ ...v, city: c, pvz: null }); setQ(''); }}>{c.name}</button>)}</div>}
      </div>
    );
  const found = matchPoints(points ?? [], pq);
  const sorted = near ? [...found].sort((a, b) => distanceKm(near, a) - distanceKm(near, b)) : found;
  const LIMIT = 100;
  const shown = sorted.slice(0, LIMIT);
  const quote = (m: CdekMode) => { const r = quotes[m]; return r === undefined ? 'СЧИТАЮ…' : r ? `${formatRub(r.price)} · ${days(r)}` : 'НЕДОСТУПНО'; };
  return (
    <div className="cdek" data-f="cdek">
      <div className="cdek__city"><span>{v.city.name}</span><button type="button" onClick={() => onChange({ city: null, mode: v.mode, pvz: null })}>сменить</button></div>
      <div className="cdek__modes" role="radiogroup">
        {(['pvz', 'door'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={v.mode === m} className={`opt ${v.mode === m ? 'is-on' : ''}`} onClick={() => { haptic.select(); onChange({ ...v, mode: m }); }}>
            <span className="opt__box" /><span><b>{m === 'pvz' ? 'Пункт выдачи' : 'Курьер до двери'}</b><small>{quote(m)}</small></span>
          </button>
        ))}
      </div>
      {v.mode === 'pvz' && (v.pvz ? (
        <div className="cdek__pts"><button type="button" className="is-on" onClick={() => onChange({ ...v, pvz: null })}>{v.pvz.address}<small>{[v.pvz.metro && `м. ${v.pvz.metro}`, v.pvz.workTime, 'нажмите, чтобы сменить'].filter(Boolean).join(' · ')}</small></button></div>
      ) : (
        <>
          <label className={`field ${err ? 'is-err' : ''}`}>
            <span className="field__l">Пункт выдачи · {points ? `${points.length} в городе` : 'загружаю…'} <button type="button" className="linkbtn" onClick={(e) => { e.preventDefault(); void locate(); }}>{locating ? 'Ищу вас…' : near ? '📍 По расстоянию' : '📍 Рядом со мной'}</button></span>
            <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Улица, дом или метро" enterKeyHint="search" /><span className="field__err">ВЫБЕРИТЕ ПУНКТ</span>
          </label>
          {!!shown.length && (
            <div className="cdek__pts">
              {shown.map((p) => {
                const km = near ? distanceKm(near, p) : Infinity;
                return <button key={p.code} type="button" onClick={() => { haptic.select(); onChange({ ...v, pvz: p }); }}>{p.address}<small>{[Number.isFinite(km) && km < 60 ? formatKm(km) : '', p.metro && `м. ${p.metro}`, p.workTime].filter(Boolean).join(' · ')}</small></button>;
              })}
            </div>
          )}
          {points && sorted.length > LIMIT && <p className="cdek__note">Показаны {LIMIT} из {sorted.length} — уточните улицу или метро{near ? '' : ', или нажмите «Рядом со мной»'}.</p>}
          {points && pq.trim() && !found.length && <p className="cdek__note">Ничего не нашлось. Попробуйте только название улицы (без «ул.», «проспект») или станцию метро.</p>}
        </>
      ))}
      <p className="cdek__note">Цена и срок — расчёт СДЭК. Отправка 1–3 дня после оплаты, трек-номер пришлёт бот.</p>
    </div>
  );
}

/** in a browser preview Telegram's payment form is drawn here; inside Telegram it's native (openInvoice) */
function EmuInvoice({ order, onClose }: { order: ApiOrder; onClose: (s: 'paid' | 'cancelled') => void }) {
  const sheet = useRef<HTMLDivElement>(null), bg = useRef<HTMLDivElement>(null);
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    anim(bg.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' });
    anim(sheet.current, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 340, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
  }, []);
  const close = async (s: 'paid' | 'cancelled') => {
    anim(bg.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    await done(anim(sheet.current, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 260, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), 360);
    onClose(s);
  };
  return createPortal(
    <>
      <div className="sheet-bg" ref={bg} onClick={() => void close('cancelled')} />
      <div className="sheet" ref={sheet} role="dialog" aria-label="Оплата">
        <div className="sheet__grab" />
        <div className="sheet__h"><span>Оплата</span><button type="button" onClick={() => void close('cancelled')}>Отмена</button></div>
        <div className="sheet__emu">ЭМУЛЯЦИЯ ФОРМЫ TELEGRAM · ВНУТРИ TELEGRAM ЕЁ РИСУЕТ САМ TELEGRAM (openInvoice) · ДЕНЬГИ НЕ СПИСЫВАЮТСЯ</div>
        {order.items.map((i) => (
          <div className="sheet__item" key={i.productId + i.size}>{i.image && <img src={imgUrl(i.image, 360)} alt="" />}<div><b>{i.title}</b><span>Размер {i.size} · ×{i.qty} · MRAK8</span></div></div>
        ))}
        <div className="sheet__row"><span>Способ оплаты</span><span>ЮKassa · тест</span></div>
        <div className="sheet__row"><span>Доставка</span><span>{order.delivery.title} · {order.delivery.price} ₽</span></div>
        <div className="sheet__row"><span>Итого</span><span><b>{formatRub(order.total)}</b></span></div>
        <button className="sheet__pay" type="button" disabled={paying} onClick={async () => { setPaying(true); await wait(900); void close('paid'); }}>{paying ? 'Обработка…' : `Оплатить ${formatRub(order.total)}`}</button>
      </div>
    </>,
    document.body,
  );
}

export function Protocol() {
  const cart = useStore((s) => s.cart);
  const boot = useStore((s) => s.boot);
  const delivery = boot?.delivery ?? [];
  const [f, setF] = useState<Form>(() => draft ?? { name: [boot?.me.firstName || tgUser.first_name, boot?.me.lastName || tgUser.last_name].filter(Boolean).join(' '), phone: '', delivery: delivery[0]?.key ?? 'cdek', address: '', comment: '', agree: false, cdek: { city: null, mode: 'pvz', pvz: null } });
  const [cdekQuote, setCdekQuote] = useState<CdekQuote | null>(null);
  const [err, setErr] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [emu, setEmu] = useState<ApiOrder | null>(null);
  const root = useRef<HTMLElement>(null);
  const sig = useRef<SVGPathElement>(null);
  useEffect(() => { draft = f; }, [f]);
  const dv = delivery.find((d) => d.key === f.delivery) ?? delivery[0];
  // with the CDEK integration on, the СДЭК price is the live quote for the chosen city and mode
  const cdekOn = !!boot?.config.cdek && dv?.key === 'cdek';
  const qty = cart.reduce((a, c) => a + c.qty, 0);
  const dPrice = cdekOn ? cdekQuote?.price ?? 0 : dv?.price ?? 0;
  const dTitle = cdekOn ? (f.cdek.mode === 'pvz' ? 'СДЭК · пункт выдачи' : 'СДЭК · курьер') : dv?.title;
  const total = cartTotal(cart) + dPrice;
  const upd = (k: keyof Form, v: Form[keyof Form]) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, [k]: false })); };

  const toggleAgree = () => {
    const on = !f.agree;
    upd('agree', on);
    const p = sig.current;
    if (!p) return;
    if (on) {
      p.setAttribute('d', signPath(tgUser.username || tgUser.id, 240, 62));
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      haptic.impact('soft');
      anim(p, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    } else p.setAttribute('d', '');
  };

  const paid = (o: ApiOrder) => {
    draft = null;
    set({ cart: [], lastOrder: o, orders: null });
    go('#/booked/' + o.no, { replace: true });
    api.bootstrap().then((b) => set({ boot: b })).catch(() => {});
  };

  const pay = async () => {
    const bad: Record<string, boolean> = {};
    if (f.name.trim().length < 3) bad.name = true;
    if (f.phone.replace(/\D/g, '').length < 10) bad.phone = true;
    if (cdekOn) {
      if (!f.cdek.city || (f.cdek.mode === 'pvz' && !f.cdek.pvz)) bad.cdek = true;
      if (f.cdek.mode === 'door' && f.address.trim().length < 6) bad.address = true;
    } else if (dv?.needsAddress && f.address.trim().length < 6) bad.address = true;
    if (!f.agree) bad.agree = true;
    if (!Object.keys(bad).length && cdekOn && !cdekQuote) { toast('СДЭК ЕЩЁ СЧИТАЕТ ДОСТАВКУ'); return; }
    if (Object.keys(bad).length) {
      setErr(bad);
      haptic.notify('error');
      const first = root.current?.querySelector<HTMLElement>(bad.name ? '[data-f=name]' : bad.phone ? '[data-f=phone]' : bad.cdek ? '[data-f=cdek]' : bad.address ? '[data-f=address]' : '[data-agree]');
      root.current?.querySelectorAll('.field.is-err, [data-f]').forEach((x) => bad[(x as HTMLElement).dataset.f || ''] && shake(x, 5));
      first?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      toast('ПРОТОКОЛ НЕ ЗАПОЛНЕН');
      return;
    }
    setBusy(true);
    try {
      // the server re-prices everything from the DB, reserves stock for 15 min and creates the Telegram invoice
      const r = await api.createOrder({ items: cart.map((c) => ({ productId: c.productId, size: c.size, qty: c.qty })), protocol: {
        name: f.name.trim(), phone: f.phone, delivery: f.delivery, comment: f.comment.trim(),
        address: cdekOn && f.cdek.mode === 'pvz' ? '' : f.address.trim(),
        ...(cdekOn && f.cdek.city ? { cdek: { cityCode: f.cdek.city.code, city: f.cdek.city.name, mode: f.cdek.mode, pvzCode: f.cdek.pvz?.code } } : {}),
      } });
      if (r.invoiceLink.startsWith('demo:')) { setEmu(r.order); return; }
      if (!inTG) { toast('ОПЛАТА ДОСТУПНА ТОЛЬКО В TELEGRAM'); return; }
      const status = await openInvoice(r.invoiceLink);
      if (status === 'paid') paid({ ...r.order, status: 'paid', paidAt: new Date().toISOString() });
      else if (status === 'failed') { haptic.notify('error'); toast('ПЛАТЁЖ ОТКЛОНЁН'); }
      else if (status === 'cancelled') toast('ОФОРМЛЕНИЕ ПРЕРВАНО СУБЪЕКТОМ');
    } catch (e) {
      haptic.notify('error');
      toast((e as Error).message);
      if (e instanceof ApiError && e.code === 'OUT_OF_STOCK') api.bootstrap().then((b) => set({ boot: b })).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  useMainButton(cart.length ? { text: `ОПЛАТИТЬ ${formatRub(total)}`, shine: !busy, progress: busy, onClick: () => void pay() } : null);

  if (!cart.length)
    return <section className="screen protocol"><div className="empty"><h2 className="display">Протокол пуст</h2><p>Нечего оформлять: пакет пуст.</p><button className="btn" onClick={() => go('#/')}>К вещдокам</button></div></section>;

  return (
    <section className="screen protocol" aria-label="Протокол оформления" ref={root}>
      <div className="form" role="form">
        <div className="form__perf" aria-hidden="true" />
        <div className="form__top"><Logo /><div className="form__no">ФОРМА № 8-ПРК · ЭКЗ. 1<br />CASE <b>#MRK-—</b> (ПРИСВАИВАЕТСЯ ПРИ ОПЛАТЕ)</div></div>
        <h1>Протокол<br />оформления</h1>
        <div className="form__sub">SUBJECT #{boot?.me.subjectNo} · {new Date().toLocaleDateString('ru-RU')} · <Clock mode="time" /></div>
        <div className="fsec">
          <div className="fsec__h"><i>1</i>Субъект</div>
          <label className={`field ${err.name ? 'is-err' : ''}`} data-f="name"><span className="field__l">ФИО субъекта <span>ИЗ TELEGRAM</span></span><input autoComplete="name" value={f.name} onChange={(e) => upd('name', e.target.value)} placeholder="Фамилия Имя" /><span className="field__err">ОБЯЗАТЕЛЬНО</span></label>
          <label className={`field ${err.phone ? 'is-err' : ''}`} data-f="phone">
            <span className="field__l">Телефон <button type="button" className="linkbtn" onClick={async (e) => { e.preventDefault(); haptic.impact('light'); const ph = await requestContact(); if (ph) { upd('phone', ph); toast('НОМЕР ПОЛУЧЕН ИЗ TELEGRAM'); } }}>Подтянуть из Telegram</button></span>
            <input type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={(e) => upd('phone', e.target.value)} placeholder="+7 ___ ___-__-__" /><span className="field__err">ОБЯЗАТЕЛЬНО</span>
          </label>
        </div>
        <div className="fsec">
          <div className="fsec__h"><i>2</i>Этапирование · доставка</div>
          <div className="opts" role="radiogroup">
            {delivery.map((d) => (
              <button key={d.key} type="button" role="radio" aria-checked={d.key === f.delivery} className={`opt ${d.key === f.delivery ? 'is-on' : ''}`} onClick={() => { haptic.select(); upd('delivery', d.key); }}>
                <span className="opt__box" /><span><b>{d.title}</b><small>{d.subtitle}</small></span><span className="opt__p">{boot?.config.cdek && d.key === 'cdek' ? (cdekQuote ? formatRub(cdekQuote.price) : 'ПО ГОРОДУ') : formatRub(d.price)}</span>
              </button>
            ))}
          </div>
          {cdekOn && <CdekPicker v={f.cdek} qty={qty} err={!!err.cdek} onQuote={setCdekQuote} onChange={(v) => upd('cdek', v)} />}
          {cdekOn && f.cdek.city && f.cdek.mode === 'door' && <label className={`field ${err.address ? 'is-err' : ''}`} data-f="address"><span className="field__l">Улица, дом, квартира</span><textarea rows={2} autoComplete="street-address" value={f.address} onChange={(e) => upd('address', e.target.value)} placeholder="ул. Ленина, 8, кв. 8" /><span className="field__err">ОБЯЗАТЕЛЬНО</span></label>}
          {!cdekOn && dv?.needsAddress && <label className={`field ${err.address ? 'is-err' : ''}`} data-f="address"><span className="field__l">Адрес доставки / ПВЗ</span><textarea rows={2} autoComplete="street-address" value={f.address} onChange={(e) => upd('address', e.target.value)} placeholder="Город, улица, дом, кв. — или код ПВЗ" /><span className="field__err">ОБЯЗАТЕЛЬНО</span></label>}
          <label className="field"><span className="field__l">Комментарий к делу <span>НЕОБЯЗАТЕЛЬНО</span></span><input value={f.comment} onChange={(e) => upd('comment', e.target.value)} placeholder="—" /></label>
        </div>
        <div className="fsec">
          <div className="fsec__h"><i>3</i>Изъято</div>
          <div className="sumrows">
            {cart.map((c) => { const p = productById(c.productId); return p && <div className="sumrow" key={c.productId + c.size}><span>{p.name} / {c.size} ×{c.qty}</span><i /><span>{formatRub(p.price * c.qty)}</span></div>; })}
            <div className="sumrow"><span>Доставка · {dTitle}</span><i /><span>{cdekOn && !cdekQuote ? '—' : formatRub(dPrice)}</span></div>
            <div className="sumrow is-total"><span>Итого к оформлению</span><i /><b>{formatRub(total)}</b></div>
          </div>
        </div>
        <button type="button" className={`agree ${f.agree ? 'is-on' : ''} ${err.agree ? 'is-err' : ''}`} data-agree role="checkbox" aria-checked={f.agree} onClick={toggleAgree}>
          <span className="opt__box" /><span>С условиями содержания ознакомлен(а): <a href="/offer.html" target="_blank" onClick={(e) => e.stopPropagation()}>оферта</a>, <a href="/privacy.html" target="_blank" onClick={(e) => e.stopPropagation()}>политика данных</a>.</span>
        </button>
        <div className="sign">
          <div><div className="sign__box"><svg viewBox="0 0 240 62" preserveAspectRatio="none"><path ref={sig} fill="none" stroke="#0B0B0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="" /></svg></div><div className="sign__l"><span>Подпись субъекта</span><span>@{tgUser.username || 'subject'}</span></div></div>
          <div className="mp">М.П.</div>
        </div>
        <p className="form__foot">Чек по 54-ФЗ придёт на телефон. Оплата — Telegram Payments · ЮKassa. Резерв вещдоков — {boot?.config.reserveMinutes ?? 15} минут.{boot?.config.testMode ? ' Тестовый режим: деньги не списываются.' : ''}</p>
      </div>
      {emu && (
        <EmuInvoice order={emu} onClose={async (s) => {
          setEmu(null);
          if (s !== 'paid') { toast('ОФОРМЛЕНИЕ ПРЕРВАНО СУБЪЕКТОМ'); return; }
          try { paid(await api.devPay(emu.no)); } catch (e) { haptic.notify('error'); toast((e as Error).message); }
        }} />
      )}
    </section>
  );
}
