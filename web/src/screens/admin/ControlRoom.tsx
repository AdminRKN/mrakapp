import { useEffect, useState } from 'react';
import { CATEGORY_LABEL, deepLink, formatRub, ORDER_STATUS_LABEL, ORDER_STATUSES, PRODUCT_STATUS_LABEL, type ApiAdminDashboard, type ApiAdminOrder, type ApiAdminProduct, type ApiDelivery, type OrderStatus } from '@mrak8/shared';
import { api } from '../../lib/api';
import { go } from '../../lib/router';
import { toast, useStore } from '../../lib/store';
import { downloadFile, haptic, inTG } from '../../lib/telegram';
import { Classified, Clock, imgUrl, Picture } from '../../components/brand';

const stCls: Record<string, string> = { live: 'st--live', drop: 'st--drop', soldout: 'st--out' };

function Spark({ vals, bars }: { vals: number[]; bars?: boolean }) {
  const max = Math.max(...vals, 1), n = vals.length;
  if (bars) return <svg className="spark" viewBox={`0 0 ${n * 10} 40`} preserveAspectRatio="none">{vals.map((v, i) => <rect key={i} x={i * 10 + 2} y={40 - (v / max) * 38} width="6" height={(v / max) * 38} fill={i === n - 1 ? '#E0241B' : '#8A8680'} fillOpacity={i === n - 1 ? 1 : 0.5} />)}</svg>;
  const pts = vals.map((v, i) => `${(i / (n - 1)) * 100},${40 - (v / max) * 36}`).join(' ');
  return <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="#E0241B" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /><polyline points={`0,40 ${pts} 100,40`} fill="#E0241B" fillOpacity=".08" stroke="none" /></svg>;
}
const Mon = ({ cam, label, children, cls = '' }: { cam: string; label: string; children: React.ReactNode; cls?: string }) => (
  <div className={`mon ${cls}`}><div className="mon__h"><span>{cam} · {label}</span><span className="rec"><i className="dot" />REC</span></div>{children}</div>
);

function Wall({ d }: { d: ApiAdminDashboard | null }) {
  if (!d) return <div className="wall">{Array.from({ length: 6 }, (_, i) => <Mon key={i} cam={`CAM_0${i + 1}`} label="ПОИСК СИГНАЛА"><div className="mon__v">—</div></Mon>)}</div>;
  const delta = d.revenueYesterday ? Math.round(((d.revenueToday - d.revenueYesterday) / d.revenueYesterday) * 100) : null;
  const week = d.revenueWeek.reduce((a, b) => a + b, 0);
  return (
    <div className="wall">
      <Mon cam="CAM_01" label="ВЫРУЧКА · СЕГОДНЯ"><Spark vals={d.hours} /><div className="mon__v">{formatRub(d.revenueToday)}</div><div className={`mon__s ${delta != null && delta < 0 ? 'dn' : 'up'}`}>{delta == null ? 'ВЧЕРА — 0 ₽' : `${delta > 0 ? '+' : ''}${delta}% К ВЧЕРА`}</div></Mon>
      <Mon cam="CAM_02" label="ВЫРУЧКА · 7 ДНЕЙ"><Spark vals={d.revenueWeek} bars /><div className="mon__v">{formatRub(week)}</div><div className="mon__s">ПОСЛЕДНИЕ 7 ДНЕЙ</div></Mon>
      <Mon cam="CAM_03" label="ЗАКАЗЫ"><div className="mon__v">{d.ordersNew}<small>СЕГОДНЯ</small></div><div className={`mon__s ${d.ordersWaiting ? 'dn' : ''}`}>● {d.ordersWaiting} ЖДУТ СБОРКИ</div></Mon>
      <Mon cam="CAM_04" label="СРЕДНИЙ ЧЕК"><div className="mon__v">{formatRub(d.avgCheck)}</div><div className="mon__s">НА НАБЛЮДЕНИИ: {d.watchers}</div></Mon>
      <Mon cam="CAM_05" label="ТОП ВЕЩДОК">{d.top?.image && <img className="mon__img" src={imgUrl(d.top.image, 360)} alt="" />}<div className="mon__v" style={{ position: 'relative' }}>{d.top ? `#${d.top.no}` : '—'}<small>{d.top ? `${d.top.qty} ШТ` : ''}</small></div><div className="mon__s" style={{ position: 'relative' }}>{d.top?.title ?? 'ПРОДАЖ ЕЩЁ НЕТ'}</div></Mon>
      <Mon cam="CAM_06" label="ОСТАТКИ НА ИСХОДЕ"><div className="mon__low">{d.lowStock.length ? d.lowStock.slice(0, 5).map((l) => <div key={l.productId + l.size}><span>#{l.no} / {l.size}</span><b>{l.available} ШТ</b></div>) : <div>ВСЁ В НОРМЕ</div>}</div></Mon>
    </div>
  );
}

function Products() {
  const [list, setList] = useState<ApiAdminProduct[] | null>(null);
  useEffect(() => { api.admin.products().then(setList).catch((e) => toast((e as Error).message)); }, []);
  return (
    <>
      <div className="alist">
        {list?.map((p) => (
          <button className="arow" key={p.id} onClick={() => { haptic.impact('light'); go('#/admin/p/' + p.id); }}>
            <span className="frow__ph">{p.images.front ? <Picture img={p.images.front} sizes="48px" width={360} /> : <Classified label="" />}</span>
            <span><h3>#{p.no} · {p.name || p.title}</h3><p>{formatRub(p.price)} · {CATEGORY_LABEL[p.category]} · {p.sizesAdmin.map((s) => `${s.label}${s.stock - s.reserved}`).join(' ')}</p></span>
            <span className={`st ${stCls[p.status] ?? ''}`}>{PRODUCT_STATUS_LABEL[p.status]}</span>
          </button>
        ))}
        {list && !list.length && <p className="label" style={{ padding: 20 }}>ВЕЩДОКОВ НЕТ</p>}
      </div>
      <button className="btn anew" onClick={() => go('#/admin/p/new')}>+ Новый вещдок</button>
    </>
  );
}

function Orders() {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [q, setQ] = useState('');
  const [list, setList] = useState<ApiAdminOrder[] | null>(null);
  const [tracks, setTracks] = useState<Record<string, string>>({});
  const load = () => api.admin.orders(status, q).then((l) => { setList(l); setTracks(Object.fromEntries(l.map((o) => [o.no, o.trackNo ?? '']))); }).catch((e) => toast((e as Error).message));
  useEffect(() => { void load(); }, [status]);
  const patch = async (no: string, p: { status?: OrderStatus; trackNo?: string | null }) => {
    try {
      const r = await api.admin.patchOrder(no, p);
      setList((l) => l && l.map((o) => (o.no === no ? r : o)));
      haptic.notify('success');
      toast(r.notified ? 'БОТ УВЕДОМИЛ СУБЪЕКТА' : `CASE #${no} → ${ORDER_STATUS_LABEL[r.status]}`);
    } catch (e) { haptic.notify('error'); toast((e as Error).message); }
  };
  const cdekShip = async (no: string) => {
    try {
      const r = await api.admin.cdekShip(no);
      setList((l) => l && l.map((o) => (o.no === no ? r : o)));
      if (r.cdek?.error) { haptic.notify('error'); toast(`СДЭК: ${r.cdek.error}`); } else { haptic.notify('success'); toast('ПЕРЕДАНО В СДЭК'); }
    } catch (e) { haptic.notify('error'); toast((e as Error).message); }
  };
  const waybill = async (no: string) => {
    toast('ГОТОВЛЮ НАКЛАДНУЮ…');
    try { await api.admin.cdekWaybill(no); haptic.notify('success'); toast('НАКЛАДНАЯ В ЧАТЕ С БОТОМ'); } catch (e) { haptic.notify('error'); toast((e as Error).message); }
  };
  const exportCsv = async () => {
    haptic.impact('light');
    if (inTG) {
      try { await api.admin.exportToChat(); toast('CSV ОТПРАВЛЕН В ЧАТ С БОТОМ'); return; } catch { /* fall back */ }
    }
    try {
      const blob = await api.admin.csv();
      const url = URL.createObjectURL(blob);
      if (!downloadFile(url, 'mrak8-orders.csv')) { const a = document.createElement('a'); a.href = url; a.download = `mrak8-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); }
      toast('CSV СФОРМИРОВАН');
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <div className="chips" style={{ padding: '12px 2px' }}>
        {(['', ...ORDER_STATUSES] as const).map((s) => <button key={s || 'all'} className={`chip ${s === status ? 'is-on' : ''}`} onClick={() => { haptic.select(); setStatus(s); }}>{s ? ORDER_STATUS_LABEL[s] : 'ВСЕ'}</button>)}
      </div>
      <div className="af" style={{ margin: '0 6px 6px' }}><input placeholder="ПОИСК: CASE, ФИО, ТЕЛЕФОН, SUBJECT" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load()} /></div>
      {list?.map((o) => (
        <div className="orow" key={o.no}>
          <div><b>CASE #{o.no}</b><p>#{o.subjectNo} · {o.name} · {o.phone} · {new Date(o.createdAt).toLocaleString('ru-RU')}<br />{o.items.map((i) => `${i.title} / ${i.size} ×${i.qty}`).join('; ')} · {formatRub(o.total)}<br />{o.delivery.title}{o.address ? ': ' + o.address : ''}{o.comment ? ` · 💬 ${o.comment}` : ''}</p></div>
          <select aria-label="Статус" value={o.status} onChange={(e) => void patch(o.no, { status: e.target.value as OrderStatus })}>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}</select>
          {o.cdek && (
            <div className="cdekbox">
              <span>СДЭК · {o.cdek.mode === 'pvz' ? `ПВЗ ${o.cdek.pvzCode}` : 'курьер'} · {o.cdek.uuid ? (o.cdek.number ? `№ ${o.cdek.number}` : 'отправление создано') : 'не передано в СДЭК'}{o.cdek.statusName ? ` · ${o.cdek.statusName}` : ''}</span>
              {o.cdek.error && <span className="cdekbox__err">ОШИБКА СДЭК: {o.cdek.error}</span>}
              <div className="cdekbox__btns">
                {!o.cdek.uuid && o.status !== 'pending' && <button onClick={() => void cdekShip(o.no)}>ПЕРЕДАТЬ В СДЭК</button>}
                {o.cdek.uuid && <button onClick={() => void waybill(o.no)}>НАКЛАДНАЯ В ЧАТ</button>}
              </div>
            </div>
          )}
          <div className="trk">
            <input value={tracks[o.no] ?? ''} placeholder="ТРЕК-НОМЕР СДЭК / ПОЧТЫ" inputMode="text" onChange={(e) => setTracks((t) => ({ ...t, [o.no]: e.target.value }))} />
            <button onClick={() => { const t = (tracks[o.no] ?? '').trim(); if (!t) { haptic.notify('error'); toast('ВВЕДИТЕ ТРЕК-НОМЕР'); return; } void patch(o.no, { trackNo: t }); }}>ОТПРАВИТЬ<br />СУБЪЕКТУ</button>
          </div>
        </div>
      ))}
      {list && !list.length && <p className="label" style={{ padding: '20px 6px' }}>ДЕЛ С ТАКИМ СТАТУСОМ НЕТ</p>}
      <button className="btn btn--ghost anew" onClick={() => void exportCsv()}>Экспорт CSV</button>
    </>
  );
}

function Drops() {
  const [list, setList] = useState<{ id: number; no: string; title: string; dropAt: string | null; watchers: number }[] | null>(null);
  useEffect(() => { api.admin.drops().then(setList).catch((e) => toast((e as Error).message)); }, []);
  return (
    <div className="alist">
      {list?.map((d) => (
        <button className="arow" key={d.id} style={{ gridTemplateColumns: '1fr auto' }} onClick={() => go('#/admin/p/' + d.id)}>
          <span><h3>#{d.no} · {d.title}</h3><p>ВЫХОД {d.dropAt ? new Date(d.dropAt).toLocaleString('ru-RU') : 'НЕ НАЗНАЧЕН'} · НА НАБЛЮДЕНИИ: {d.watchers}</p></span>
          <span className="st st--drop">ДРОП</span>
        </button>
      ))}
      {list && !list.length && <p className="label" style={{ padding: '20px 6px', lineHeight: 1.6 }}>ЗАПЛАНИРОВАННЫХ ДРОПОВ НЕТ.<br />ДРОП = СТАТУС «ДРОП СКОРО» + ДАТА ВЫХОДА В РЕДАКТОРЕ ВЕЩДОКА. В МОМЕНТ ВЫХОДА БОТ НАПИШЕТ ВСЕМ, КТО НАЖАЛ «УВЕДОМИТЬ МЕНЯ».</p>}
    </div>
  );
}

function Delivery() {
  const [list, setList] = useState<(ApiDelivery & { active: boolean })[] | null>(null);
  useEffect(() => { api.admin.delivery().then(setList).catch((e) => toast((e as Error).message)); }, []);
  const upd = (i: number, p: Partial<ApiDelivery & { active: boolean }>) => setList((l) => l && l.map((d, k) => (k === i ? { ...d, ...p } : d)));
  return (
    <div className="ed__sec" style={{ border: 0 }}>
      <h2>Способы этапирования</h2>
      {list?.map((d, i) => (
        <div key={d.key} style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 10, marginBottom: 10 }}>
          <div className="af2"><label className="af"><span>Название</span><input value={d.title} onChange={(e) => upd(i, { title: e.target.value })} /></label><label className="af"><span>Цена, ₽</span><input inputMode="numeric" value={d.price} onChange={(e) => upd(i, { price: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label></div>
          <label className="af"><span>Подпись</span><input value={d.subtitle} onChange={(e) => upd(i, { subtitle: e.target.value })} /></label>
          <div className="seg"><button className={d.active ? 'is-on' : ''} onClick={() => upd(i, { active: !d.active })}>{d.active ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}</button><button className={d.needsAddress ? 'is-on' : ''} onClick={() => upd(i, { needsAddress: !d.needsAddress })}>{d.needsAddress ? 'НУЖЕН АДРЕС' : 'БЕЗ АДРЕСА'}</button></div>
        </div>
      ))}
      <button className="btn btn--block" onClick={async () => { try { await api.admin.saveDelivery(list ?? []); haptic.notify('success'); toast('ДОСТАВКА СОХРАНЕНА'); } catch (e) { toast((e as Error).message); } }}>Сохранить</button>
    </div>
  );
}

function Channel() {
  const products = useStore((s) => s.boot?.products ?? []);
  const p = products.find((x) => x.status === 'live') ?? products[0];
  const link = useStore((s) => s.boot?.config.miniappLink ?? '');
  if (!p) return null;
  return (
    <div className="ed__sec" style={{ border: 0, marginTop: 8 }}>
      <h2>Пост в канал <span>КНОПКА → КАРТОЧКА #{p.no} В БОТЕ</span></h2>
      <div className="post">
        <div className="post__img">{p.images.front && <img src={imgUrl(p.images.front, 720)} alt="" />}</div>
        <p style={{ margin: '8px 2px' }}>🟥 ВЕЩДОК #{p.no} — {p.title}<br />Партия {p.batch} · {formatRub(p.price)}<br />NO EMOTIONAL CONTRABAND.</p>
        <div className="post__btn">ОТКРЫТЬ ДЕЛО #{p.no} ↗</div>
      </div>
      <p className="label" style={{ margin: '10px 0' }}>ССЫЛКА: {deepLink(link, `product_${p.id}`)}</p>
      <button className="btn btn--red btn--block" onClick={async () => { try { await api.admin.announce(p.id); haptic.notify('success'); toast('ПОСТ ОПУБЛИКОВАН В КАНАЛЕ'); } catch (e) { haptic.notify('error'); toast((e as Error).message); } }}>Анонсировать в канале</button>
      <p className="label" style={{ marginTop: 8 }}>ДРУГОЙ ВЕЩДОК — КНОПКА «АНОНС В КАНАЛ» В ЕГО РЕДАКТОРЕ</p>
    </div>
  );
}

const TABS = [['products', 'ТОВАРЫ'], ['orders', 'ЗАКАЗЫ'], ['drops', 'ДРОПЫ'], ['delivery', 'ДОСТАВКА'], ['channel', 'КАНАЛ']] as const;

export function ControlRoom({ tab }: { tab: string }) {
  const me = useStore((s) => s.boot?.me);
  const [d, setD] = useState<ApiAdminDashboard | null>(null);
  useEffect(() => { if (me?.isAdmin) api.admin.dashboard().then(setD).catch((e) => toast((e as Error).message)); }, [me?.isAdmin]);
  if (!me?.isAdmin)
    return <section className="screen"><div className="empty"><span className="lost__sig">● ДОСТУП ЗАПРЕЩЁН</span><h2 className="display">Пульт только для дежурных</h2><p>Попытка зафиксирована. SUBJECT #{me?.subjectNo}</p><button className="btn" onClick={() => go('#/')}>К вещдокам</button></div></section>;
  return (
    <section className="screen" aria-label="Control room">
      <div className="ctrl">
        <div className="ctrl__h"><div><span className="label">ПУЛЬТ ДЕЖУРНОГО · OP #{me.subjectNo} · <b>● LIVE</b></span><h1 className="display">Control room</h1></div><span className="label"><Clock mode="time" /></span></div>
        <Wall d={d} />
        <h2 className="ctrl__sec">{TABS.find(([k]) => k === tab)?.[1] ?? 'ТОВАРЫ'}</h2>
        {tab === 'orders' ? <Orders /> : tab === 'drops' ? <Drops /> : tab === 'delivery' ? <Delivery /> : tab === 'channel' ? <Channel /> : <Products />}
      </div>
    </section>
  );
}
