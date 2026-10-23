import { useEffect, useState } from 'react';
import { CATEGORIES, CATEGORY_LABEL, PRODUCT_STATUS_LABEL, PRODUCT_STATUSES, type ApiAdminProduct, type ApiAdminProductInput, type ApiImage } from '@mrak8/shared';
import { api } from '../../lib/api';
import { go } from '../../lib/router';
import { set, toast } from '../../lib/store';
import { haptic } from '../../lib/telegram';
import { imgUrl } from '../../components/brand';
import { useMainButton } from '../../components/useMainButton';

type Sizes = ApiAdminProductInput['sizes'];
const emptySize = (label: string, hMin: number | null, hMax: number | null) => ({ label, stock: 0, heightMin: hMin, heightMax: hMax, length: null, width: null, sleeve: null });
const blank = (): ApiAdminProductInput => ({
  no: '', slug: '', title: '', name: '', sub: '', category: 'hoodie', price: 0, oldPrice: null, color: '', batch: '1/50', status: 'draft', dropAt: null,
  proto: [{ k: 'МАТЕРИАЛ', v: '' }, { k: 'ПОСАДКА', v: '' }, { k: 'ЦВЕТ', v: '' }],
  hotspots: { front: [], back: [] },
  sizes: [emptySize('S', 163, 171), emptySize('M', 171, 179), emptySize('L', 179, 187), emptySize('XL', 187, 195)],
});
const toInput = (p: ApiAdminProduct): ApiAdminProductInput => ({
  no: p.no, slug: p.slug, title: p.title, name: p.name, sub: p.sub, category: p.category, price: p.price, oldPrice: p.oldPrice, color: p.color, batch: p.batch, status: p.status, dropAt: p.dropAt, proto: p.proto, hotspots: p.hotspots,
  sizes: p.sizesAdmin.map(({ label, stock, heightMin, heightMax, length, width, sleeve }) => ({ label, stock, heightMin, heightMax, length, width, sleeve })),
});
const slugify = (s: string) => s.toLowerCase().replace(/[«»"']/g, '').replace(/[а-яё]/g, (c) => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' } as Record<string, string>)[c] ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\D/g, '')) || 0);
const localDT = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');

function Slot({ label, img, onFile, onRemove, crop }: { label: string; img: ApiImage | null; onFile: (f: File) => void; onRemove?: () => void; crop: string }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (f?: File | null) => { if (!f) return; setBusy(true); try { await onFile(f); } finally { setBusy(false); } };
  return (
    <label className={`slot ${crop === '11' ? 'is-1x1' : ''} ${drag ? 'is-drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void take(e.dataTransfer.files[0]); }}>
      <span className="slot__l">{label}</span>
      {img ? <img className={img.alpha ? 'contain' : ''} src={imgUrl(img, 360)} alt="" /> : <span className="slot__plus"><b>{busy ? '…' : '+'}</b>{busy ? 'ОБРАБОТКА' : <>ПЕРЕТАЩИ<br />ИЛИ ВЫБЕРИ</>}</span>}
      <input type="file" accept="image/*" onChange={(e) => void take(e.target.files?.[0])} />
      {img && onRemove && <button type="button" onClick={(e) => { e.preventDefault(); onRemove(); }} style={{ position: 'absolute', right: 4, top: 4, zIndex: 2, background: '#0B0B0B', border: '1px solid #8A8680', color: '#F1ECE1', font: '700 9px var(--font-mono)', padding: '4px 6px' }}>УБРАТЬ</button>}
    </label>
  );
}

export function Editor({ id }: { id: string }) {
  const isNew = id === 'new';
  const [p, setP] = useState<ApiAdminProduct | null>(null);
  const [f, setF] = useState<ApiAdminProductInput>(blank);
  const [crop, setCrop] = useState('45');
  const [cutout, setCutout] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (isNew) return;
    api.admin.product(Number(id)).then((x) => { setP(x); setF(toInput(x)); }).catch((e) => toast((e as Error).message));
  }, [id]);
  const upd = <K extends keyof ApiAdminProductInput>(k: K, v: ApiAdminProductInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const updSize = (i: number, patch: Partial<Sizes[number]>) => setF((x) => ({ ...x, sizes: x.sizes.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const save = async () => {
    if (!/^\d{3,4}$/.test(f.no)) { haptic.notify('error'); toast('НОМЕР ВЕЩДОКА: 3–4 ЦИФРЫ'); return; }
    if (f.title.trim().length < 2) { haptic.notify('error'); toast('НУЖНО НАЗВАНИЕ'); return; }
    setSaving(true);
    try {
      const body = { ...f, slug: f.slug || slugify(f.title) || `item-${f.no}`, dropAt: f.status === 'drop' ? f.dropAt : null };
      const r = isNew ? await api.admin.create(body) : await api.admin.update(Number(id), body);
      setP(r);
      setF(toInput(r));
      haptic.notify('success');
      toast(`ВЕЩДОК #${r.no} СОХРАНЁН`);
      api.bootstrap().then((b) => set({ boot: b })).catch(() => {});
      if (isNew) go('#/admin/p/' + r.id, { replace: true });
    } catch (e) {
      haptic.notify('error');
      toast((e as Error).message);
    } finally { setSaving(false); }
  };
  const upload = async (slot: 'front' | 'back' | 'detail', file: File) => {
    if (!p) { toast('СНАЧАЛА СОХРАНИТЕ ВЕЩДОК'); return; }
    try {
      await api.admin.upload(p.id, file, slot, crop, cutout);
      const x = await api.admin.product(p.id);
      setP(x);
      haptic.notify('success');
      toast('ФОТО ОБРАБОТАНО · WEBP + AVIF');
    } catch (e) { haptic.notify('error'); toast((e as Error).message); }
  };
  const removeImg = async (imageId: number) => {
    await api.admin.removeImage(imageId);
    if (p) setP(await api.admin.product(p.id));
  };

  useMainButton({ text: saving ? 'СОХРАНЕНИЕ…' : 'СОХРАНИТЬ ВЕЩДОК', progress: saving, onClick: () => void save() }, p ? { text: 'АНОНС В КАНАЛ', onClick: async () => { try { await api.admin.announce(p.id); haptic.notify('success'); toast('ПОСТ ОПУБЛИКОВАН'); } catch (e) { toast((e as Error).message); } } } : null);

  return (
    <section className="screen" aria-label="Редактор вещдока">
      <div className="ctrl ed">
        <div className="ctrl__h"><div><span className="label">CONTROL ROOM · {isNew ? 'НОВЫЙ ВЕЩДОК' : 'ДЕЛО #' + f.no}</span><h1 className="display">{isNew ? 'Новый вещдок' : 'Вещдок #' + f.no}</h1></div><span className={`st ${f.status === 'live' ? 'st--live' : f.status === 'drop' ? 'st--drop' : f.status === 'soldout' ? 'st--out' : ''}`}>{PRODUCT_STATUS_LABEL[f.status]}</span></div>

        <div className="ed__sec"><h2>Основное</h2>
          <label className="af"><span>Название</span><input value={f.title} onChange={(e) => upd('title', e.target.value)} placeholder="ZIP-HOODIE «...»" /></label>
          <div className="af2"><label className="af"><span>Строка 1 (крупно)</span><input value={f.name} onChange={(e) => upd('name', e.target.value)} placeholder="ZIP-HOODIE" /></label><label className="af"><span>Строка 2</span><input value={f.sub} onChange={(e) => upd('sub', e.target.value)} placeholder="«НЕ ДИЗАЙНЕР»" /></label></div>
          <div className="af2"><label className="af"><span>Номер вещдока</span><input value={f.no} inputMode="numeric" onChange={(e) => upd('no', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="002" /></label><label className="af"><span>Slug</span><input value={f.slug} onChange={(e) => upd('slug', e.target.value)} placeholder={slugify(f.title) || 'zip-hoodie'} /></label></div>
          <div className="af2"><label className="af"><span>Категория</span><select value={f.category} onChange={(e) => upd('category', e.target.value as ApiAdminProductInput['category'])}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></label><label className="af"><span>Партия</span><input value={f.batch} onChange={(e) => upd('batch', e.target.value)} /></label></div>
          <div className="af2"><label className="af"><span>Цена, ₽</span><input inputMode="numeric" value={f.price || ''} onChange={(e) => upd('price', num(e.target.value) ?? 0)} /></label><label className="af"><span>Старая цена, ₽</span><input inputMode="numeric" value={f.oldPrice ?? ''} onChange={(e) => upd('oldPrice', num(e.target.value))} placeholder="—" /></label></div>
          <label className="af"><span>Цвет</span><input value={f.color} onChange={(e) => upd('color', e.target.value)} /></label>
        </div>

        <div className="ed__sec"><h2>Фото <span className="seg" role="group"><button className={crop === '45' ? 'is-on' : ''} onClick={() => setCrop('45')}>4:5</button><button className={crop === '11' ? 'is-on' : ''} onClick={() => setCrop('11')}>1:1</button><button className={crop === 'none' ? 'is-on' : ''} onClick={() => setCrop('none')}>КАК ЕСТЬ</button><button className={cutout ? 'is-on' : ''} onClick={() => setCutout(!cutout)}>ВЫРЕЗАТЬ ЧЁРНЫЙ ФОН</button></span></h2>
          {!p && <p className="label">ФОТО МОЖНО ДОБАВИТЬ ПОСЛЕ ПЕРВОГО СОХРАНЕНИЯ</p>}
          <div className="slots">
            <Slot label="ФАС" crop={crop} img={p?.images.front ?? null} onFile={(file) => upload('front', file)} onRemove={p?.images.front ? () => void removeImg(p.images.front!.id) : undefined} />
            <Slot label="СПИНА" crop={crop} img={p?.images.back ?? null} onFile={(file) => upload('back', file)} onRemove={p?.images.back ? () => void removeImg(p.images.back!.id) : undefined} />
            {p?.images.details.map((d, i) => <Slot key={d.id} label={`ДЕТАЛЬ ${i + 1}`} crop={crop} img={d} onFile={() => {}} onRemove={() => void removeImg(d.id)} />)}
            <Slot label={`ДЕТАЛЬ ${(p?.images.details.length ?? 0) + 1}`} crop={crop} img={null} onFile={(file) => upload('detail', file)} />
          </div>
          <p className="label" style={{ marginTop: 8 }}>СЕРВЕР: SHARP → AVIF + WEBP 360/720/1200/2400 + LQIP → S3 ИЛИ ЛОКАЛЬНЫЙ ДИСК</p>
        </div>

        <div className="ed__sec"><h2>Размеры, остатки, ростомер <span><button className="linkbtn" onClick={() => upd('sizes', [...f.sizes, emptySize('NEW', null, null)])}>+ размер</button></span></h2>
          <table className="stbl"><thead><tr><th>РАЗМЕР</th><th>ОСТАТОК</th><th>РОСТ ОТ</th><th>РОСТ ДО</th><th /></tr></thead><tbody>
            {f.sizes.map((s, i) => (
              <tr key={i}>
                <td><input value={s.label} onChange={(e) => updSize(i, { label: e.target.value.toUpperCase().slice(0, 8) })} style={{ font: '800 14px var(--font-display)' }} /></td>
                <td><span className="stp"><button onClick={() => updSize(i, { stock: Math.max(0, s.stock - 1) })}>−</button><output className={s.stock ? '' : 'is-zero'}>{s.stock}</output><button onClick={() => updSize(i, { stock: s.stock + 1 })}>+</button></span></td>
                <td><input inputMode="numeric" value={s.heightMin ?? ''} onChange={(e) => updSize(i, { heightMin: num(e.target.value) })} /></td>
                <td><input inputMode="numeric" value={s.heightMax ?? ''} onChange={(e) => updSize(i, { heightMax: num(e.target.value) })} /></td>
                <td><button className="linkbtn" onClick={() => upd('sizes', f.sizes.filter((_, k) => k !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody></table>
          {p && <p className="label" style={{ marginTop: 6 }}>В РЕЗЕРВЕ СЕЙЧАС: {p.sizesAdmin.map((s) => `${s.label} ${s.reserved}`).join(' · ')}</p>}
        </div>

        <div className="ed__sec"><h2>Замеры, см</h2>
          <table className="stbl"><thead><tr><th>РАЗМЕР</th><th>ДЛИНА</th><th>ШИРИНА</th><th>РУКАВ</th></tr></thead><tbody>
            {f.sizes.map((s, i) => (
              <tr key={i}><td>{s.label}</td>{(['length', 'width', 'sleeve'] as const).map((k) => <td key={k}><input inputMode="numeric" value={s[k] ?? ''} onChange={(e) => updSize(i, { [k]: num(e.target.value) })} /></td>)}</tr>
            ))}
          </tbody></table>
        </div>

        <div className="ed__sec"><h2>Статус</h2>
          <div className="seg">{PRODUCT_STATUSES.map((s) => <button key={s} className={s === f.status ? 'is-on' : ''} onClick={() => { haptic.select(); upd('status', s); }}>{PRODUCT_STATUS_LABEL[s]}</button>)}</div>
          {f.status === 'drop' && <label className="af" style={{ marginTop: 10 }}><span>Выход дропа (ваше время)</span><input type="datetime-local" value={localDT(f.dropAt)} onChange={(e) => upd('dropAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></label>}
        </div>

        <div className="ed__sec"><h2>Протокол осмотра <span><button className="linkbtn" onClick={() => upd('proto', [...f.proto, { k: '', v: '' }])}>+ строка</button></span></h2>
          {f.proto.map((r, i) => (
            <div className="af2" key={i} style={{ gridTemplateColumns: '1fr 2fr auto', alignItems: 'end' }}>
              <label className="af"><span>Поле</span><input value={r.k} onChange={(e) => upd('proto', f.proto.map((x, k) => (k === i ? { ...x, k: e.target.value.toUpperCase() } : x)))} /></label>
              <label className="af"><span>Значение</span><input value={r.v} onChange={(e) => upd('proto', f.proto.map((x, k) => (k === i ? { ...x, v: e.target.value, todo: false } : x)))} /></label>
              <button className="linkbtn" style={{ marginBottom: 18 }} onClick={() => upd('proto', f.proto.filter((_, k) => k !== i))}>✕</button>
            </div>
          ))}
        </div>

        {!isNew && (
          <button className={`btn anew ${sure ? 'btn--red' : 'btn--ghost'}`} onClick={async () => {
            if (!sure) { setSure(true); haptic.notify('warning'); setTimeout(() => setSure(false), 3000); return; }
            const r = await api.admin.remove(Number(id));
            toast(r.archived ? 'ЕСТЬ ЗАКАЗЫ — ПЕРЕНЕСЁН В АРХИВ' : 'ВЕЩДОК УДАЛЁН');
            go('#/admin', { replace: true });
          }}>{sure ? 'Точно снять? Нажмите ещё раз' : 'Снять с учёта'}</button>
        )}
      </div>
    </section>
  );
}
