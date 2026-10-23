import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { deepLink, formatRub, qrSVG, subjectNo, type ApiOrder } from '@mrak8/shared';
import { api } from '../lib/api';
import { anim, done, reduced, sealSVG, slam, stampSVG } from '../lib/fx';
import { go } from '../lib/router';
import { set, toast, useStore } from '../lib/store';
import { haptic, inTG, openTelegramLink, shareMessage, shareToStory, tgUser } from '../lib/telegram';
import { HChart, Logo } from '../components/brand';
import { useMainButton } from '../components/useMainButton';

const d2 = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU')}`; };

function SharePreview({ order, onClose }: { order: ApiOrder; onClose: () => void }) {
  const boot = useStore((s) => s.boot);
  const link = boot?.config.miniappLink ?? '';
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => { anim(card.current, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' }); }, []);
  const toChat = async () => {
    haptic.impact('light');
    try {
      const { id } = await api.share(order.no);
      const sent = await shareMessage(id);
      if (sent) { haptic.notify('success'); toast('ДЕЛО ПЕРЕДАНО'); onClose(); return; }
    } catch { /* bot without inline mode or old client — fall back to a share link */ }
    openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(deepLink(link, 'from_share'))}&text=${encodeURIComponent('Меня оформили в MRAK8 Central Booking. NO EMOTIONAL CONTRABAND.')}`);
    onClose();
  };
  const toStory = () => {
    const ok = shareToStory(`${location.origin}/share/story.jpg`, `SUBJECT #${subjectNo(tgUser.id)} оформлен в MRAK8`, link);
    if (!ok) toast('ИСТОРИИ ДОСТУПНЫ В TELEGRAM 7.8+');
    onClose();
  };
  return createPortal(
    <div className="share" role="dialog" aria-label="Поделиться" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="share__card" ref={card}>
        <div className="share__emu">{inTG ? 'ПОДЕЛИТЬСЯ ДЕЛОМ' : 'ПРЕДПРОСМОТР · shareMessage(prepared_message_id)'}</div>
        <div className="msg">
          <div className="msg__img">
            <HChart from={150} to={200} strong={0.22} weak={0.08} />
            <div style={{ position: 'absolute', left: 12, top: 12, width: 84, color: '#fff' }}><Logo /></div>
            <div style={{ position: 'absolute', right: 12, top: 12, textAlign: 'right', font: '600 9px/1.4 var(--font-mono)', letterSpacing: '.08em', color: '#8A8680' }}>SUBJECT<br /><b style={{ color: '#F1ECE1', fontSize: 13 }}>#{subjectNo(tgUser.id)}</b></div>
            <div style={{ position: 'absolute', left: 12, bottom: 12, font: '900 34px/.85 var(--font-display)', color: '#F1ECE1', textTransform: 'uppercase' }}>Я оформлен<br />в MRAK8</div>
            <div style={{ position: 'absolute', right: 8, bottom: 18, width: '52%', color: '#E0241B', transform: 'rotate(-12deg)' }} dangerouslySetInnerHTML={{ __html: stampSVG('ОФОРМЛЕН', 'CASE #' + order.no, { w: 300, h: 100 }) }} />
          </div>
          <div className="msg__txt">Меня оформили в MRAK8 Central Booking. NO EMOTIONAL CONTRABAND.</div>
          <div className="msg__btn">ОФОРМИТЬСЯ В MRAK8 ↗</div>
        </div>
        <div className="share__acts"><button type="button" onClick={() => void toChat()}>Отправить другу</button><button type="button" onClick={toStory}>В историю</button></div>
      </div>
    </div>,
    document.body,
  );
}

export function Booked({ no }: { no: string }) {
  const last = useStore((s) => s.lastOrder);
  const me = useStore((s) => s.boot?.me);
  const [o, setO] = useState<ApiOrder | null>(last && last.no === no ? last : null);
  const [share, setShare] = useState(false);
  const bform = useRef<HTMLDivElement>(null);
  const receipt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (o) return;
    api.order(no).then(setO).catch(() => toast('ДЕЛО НЕ НАЙДЕНО'));
  }, [no]);

  // the stamp hits «М.П.», then the receipt prints line by line
  useEffect(() => {
    if (!o) return;
    let alive = true;
    (async () => {
      await done(anim(bform.current, [{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }), 520);
      if (!alive || !bform.current) return;
      await slam(bform.current, 'ОФОРМЛЕН', { sub: `CASE #${o.no} · ${new Date().toLocaleDateString('ru-RU')}`, rot: -11, haptic: 'success', cls: 'stamp--paper', w: 320, h: 104 });
      // then the duty officer's round seal lands on «М.П.»
      const seal = bform.current?.querySelector('.seal');
      await done(anim(seal, [
        { transform: 'scale(1.5) rotate(-24deg)', opacity: 0, filter: 'blur(2px)' },
        { transform: 'scale(.95) rotate(16deg)', opacity: 0.92, filter: 'blur(0px)', offset: 0.7 },
        { transform: 'scale(1) rotate(14deg)', opacity: 0.88 },
      ], { duration: 260, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' }), 320);
      haptic.impact('rigid');
      const lines = Array.from(receipt.current?.querySelectorAll<HTMLElement>('.receipt__in > *') ?? []);
      if (reduced) lines.forEach((n) => (n.style.opacity = '1'));
      else lines.forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 180, delay: i * 45, fill: 'forwards', easing: 'steps(3)' }));
    })();
    // poll until the webhook marks the order paid (successful_payment can lag behind the client callback)
    let tries = 0;
    const poll = setInterval(async () => {
      if (++tries > 10) return clearInterval(poll);
      try { const fresh = await api.order(o.no); if (fresh.status !== 'pending') { clearInterval(poll); set({ lastOrder: fresh }); } } catch { /* offline */ }
    }, 2500);
    return () => { alive = false; clearInterval(poll); };
  }, [o?.no]);

  useMainButton(o ? { text: 'ПОДЕЛИТЬСЯ: «Я ОФОРМЛЕН»', shine: true, onClick: () => { haptic.impact('light'); setShare(true); } } : null, o ? { text: 'В КАТАЛОГ', onClick: () => go('#/') } : null);

  if (!o) return <section className="screen"><div className="empty"><h2 className="display">Поиск дела…</h2></div></section>;
  const link = deepLink(useStore.getState().boot?.config.miniappLink ?? 'https://t.me', `order_${o.no}`);
  const paidAt = o.paidAt ?? o.createdAt;
  return (
    <section className="screen" aria-label="Оформлен">
      <div className="booked">
        <div className="booked__case"><h1 className="display">Оформлен</h1><span className="label">CASE <b style={{ color: 'var(--mrak-cream)' }}>#{o.no}</b></span></div>
        <div className="bform" ref={bform}>
          <div className="form__top"><Logo /><div className="form__no">ФОРМА № 8-ПРК · ЭКЗ. 2<br />CASE <b>#{o.no}</b></div></div>
          <h2>Протокол оформления</h2>
          <dl>
            <div className="kv"><dt>Субъект</dt><dd>#{me?.subjectNo}</dd></div>
            <div className="kv"><dt>ФИО</dt><dd>{o.name}</dd></div>
            <div className="kv"><dt>Дата / время</dt><dd>{d2(paidAt)}</dd></div>
            <div className="kv"><dt>Этапирование</dt><dd>{o.delivery.title}</dd></div>
            <div className="kv"><dt>Сумма</dt><dd>{formatRub(o.total)}</dd></div>
          </dl>
          <div className="mp" aria-hidden="true">М.П.</div>
          <div className="seal" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sealSVG('MRAK8 ✶ CENTRAL BOOKING & INTAKE CENTER ✶ ', 'ДЕЖУРНЫЙ') }} />
        </div>
        <div className="receipt" ref={receipt} aria-label="Квитанция">
          <div className="receipt__in">
            <div className="c"><Logo className="lg" /></div>
            <div className="c">MRAK8 CENTRAL BOOKING &amp; INTAKE CENTER</div>
            <div className="c">КВИТАНЦИЯ ОБ ОФОРМЛЕНИИ</div>
            <div className="hr" />
            <div className="ln"><span>CASE</span><i /><span>#{o.no}</span></div>
            <div className="ln"><span>SUBJECT</span><i /><span>#{me?.subjectNo}</span></div>
            <div className="ln"><span>ДАТА</span><i /><span>{d2(paidAt)}</span></div>
            <div className="hr" />
            {o.items.map((it, i) => (
              <div key={i}><div>{String(i + 1).padStart(2, '0')} {it.title}</div><div className="ln"><span>&nbsp;&nbsp; {it.size} × {it.qty}</span><i /><span>{formatRub(it.price * it.qty)}</span></div></div>
            ))}
            <div className="ln"><span>ДОСТАВКА · {o.delivery.title.toUpperCase()}</span><i /><span>{formatRub(o.delivery.price)}</span></div>
            <div className="hr" />
            <div className="ln tot"><span>ИТОГО</span><i /><span>{formatRub(o.total)}</span></div>
            <div className="ln"><span>ОПЛАЧЕНО</span><i /><span>TELEGRAM · ЮKASSA</span></div>
            <div className="ln"><span>ЧЕК 54-ФЗ</span><i /><span>НА ТЕЛЕФОН</span></div>
            <div className="qr" dangerouslySetInnerHTML={{ __html: qrSVG(link) }} />
            <div className="c" style={{ fontSize: 9 }}>СКАНИРУЙ — ДЕЛО ОТКРОЕТСЯ В TELEGRAM</div>
            <div className="hr" />
            <div className="c">NO EMOTIONAL CONTRABAND.<br />ALL SUBJECTS ARE MONITORED.</div>
          </div>
        </div>
      </div>
      {share && <SharePreview order={o} onClose={() => setShare(false)} />}
    </section>
  );
}
