import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { anim, done, esc, shake, typeInto, wait } from '../lib/fx';
import { haptic, tgUser } from '../lib/telegram';
import { Clock, HChart, LogoLayers } from '../components/brand';

const silhouette = (
  <svg viewBox="0 0 100 120" aria-hidden="true"><path d="M50 14c-14 0-22 11-22 25 0 10 4 18 10 22l-1 8C21 73 9 81 6 96v24h88V96c-3-15-15-23-31-27l-1-8c6-4 10-12 10-22 0-14-8-25-22-25z" fill="#4a4743" /></svg>
);

/**
 * «Оформление»: letters drop, the 8's rings unwind from a point, the subject is scanned in a mugshot frame.
 * ~2 s on the first visit, ~1 s afterwards (the mugshot with the Telegram photo stays), tap to skip. `ready` is the bootstrap request — the splash
 * never ends before the data is there, so the catalog appears complete.
 */
export function Splash({ short, subject, ready, onDone }: { short: boolean; subject: string; ready: Promise<unknown>; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const s = root.current!;
    let skip = false;
    let resolveSkip: () => void = () => {};
    const skipP = new Promise<void>((r) => (resolveSkip = r));
    const onTap = () => { skip = true; resolveSkip(); };
    s.addEventListener('click', onTap);
    const W = (ms: number) => Promise.race([wait(ms), skipP]);
    const $ = (q: string) => s.querySelector(q) as HTMLElement;
    const terms = Array.from(s.querySelectorAll<HTMLElement>('.splash__term p'));
    const name = tgUser.username ? '@' + tgUser.username : tgUser.first_name || 'SUBJECT';

    const run = async () => {
      const rt = $('.ring--t'), rb = $('.ring--b');
      if (short) {
        anim(rt, [{ transform: 'rotateY(-180deg)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
        anim(rb, [{ transform: 'rotateX(180deg)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
        // return visits keep the mugshot: the subject's own Telegram photo is what makes the booking personal
        anim($('.splash__mug'), [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'steps(3)', fill: 'forwards' });
        anim($('.mug__scan'), [{ transform: 'translateY(0)' }, { transform: 'translateY(440%)' }], { duration: 720, easing: 'cubic-bezier(.65,0,.35,1)' });
        anim($('.mug__lock'), [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.5 }, { transform: 'scale(1)', opacity: 1 }], { duration: 480, delay: 160, easing: 'steps(3)', fill: 'backwards' });
        terms[0].innerHTML = `&gt; SUBJECT <b>#${esc(subject)}</b> — <span class="ok">С ВОЗВРАЩЕНИЕМ</span>`;
        await W(1100);
        return;
      }
      anim(rb, [{ transform: 'scale(0) rotateX(-560deg) rotateY(40deg)' }, { transform: 'scale(1.04) rotateX(-10deg)', offset: 0.75 }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      anim(rt, [{ transform: 'scale(0) rotateY(-620deg) rotateX(60deg)' }, { transform: 'scale(1.05) rotateY(8deg)', offset: 0.75 }, { transform: 'none' }], { duration: 960, delay: 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      s.querySelectorAll('.l-letter').forEach((l, i) =>
        anim(l, [{ transform: 'translateY(-170%)' }, { transform: 'translateY(0)', offset: 0.68 }, { transform: 'translateY(-5%) scaleY(1.02)', offset: 0.84 }, { transform: 'translateY(0)' }], { duration: 560, delay: 170 + i * 70, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'backwards' }),
      );
      await W(170 + 3 * 70 + 380);
      haptic.impact('rigid');
      shake(s, 3);
      anim($('.splash__scan'), [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 1, transform: `translateY(${innerHeight}px)` }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' });
      await W(120);
      anim($('.splash__mug'), [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'steps(4)', fill: 'forwards' });
      anim($('.mug__scan'), [{ transform: 'translateY(0)' }, { transform: 'translateY(440%)' }], { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)' });
      anim($('.mug__lock'), [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.5 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, delay: 300, easing: 'steps(3)', fill: 'backwards' });
      await typeInto(terms[0], '&gt; SCANNING SUBJECT…', 95, () => skip);
      if (skip) return;
      await W(120);
      await typeInto(terms[1], `&gt; <b>${esc(name)}</b> IDENTIFIED`, 95, () => skip);
      if (skip) return;
      await W(90);
      await typeInto(terms[2], `&gt; SUBJECT <b>#${esc(subject)}</b> — <span class="ok">ДОСТУП РАЗРЕШЁН</span>`, 110, () => skip);
      haptic.notify('success');
      await W(420);
    };

    let alive = true;
    (async () => {
      await Promise.race([run(), skipP]);
      await ready.catch(() => {});
      if (!alive) return;
      s.classList.add('is-out');
      await done(anim(s, [
        { transform: 'scale(1,1)', filter: 'brightness(1)', opacity: 1 },
        { transform: 'scale(1,.006)', filter: 'brightness(2.5)', opacity: 1, offset: 0.55 },
        { transform: 'scale(0,.006)', filter: 'brightness(3)', opacity: 0 },
      ], { duration: 360, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), 460);
      if (alive) onDone();
    })();
    return () => { alive = false; s.removeEventListener('click', onTap); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toLocaleDateString('ru-RU');
  return createPortal(
    <div className="splash" ref={root} role="dialog" aria-label="Оформление субъекта">
      <div className="splash__corners" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="splash__osd" aria-hidden="true"><span className="rec"><i className="dot" />REC · CAM_08 · INTAKE</span><Clock mode="tc" /></div>
      <div className="splash__logo"><LogoLayers /></div>
      <div className="splash__mug" aria-hidden="true">
        <div className="mug">
          <HChart className="mug__chart hchart" from={150} to={200} minor={2} major={10} label={10} strong={0.35} weak={0.12} labels={[160, 190, 10]} />
          {tgUser.photo_url ? <img className="mug__img" src={tgUser.photo_url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', bottom: 'auto', top: 0 }} /> : <div className="mug__img">{silhouette}</div>}
          <div className="mug__lock"><i /><i /><i /><i /></div>
          <div className="mug__board"><span>MRAK8 CENTRAL BOOKING</span><b>#{subject}</b><span>{today}</span></div>
          <div className="mug__scan" />
        </div>
      </div>
      <div className="splash__term" aria-live="polite"><p /><p /><p /></div>
      <div className="splash__skip">ТАП — ПРОПУСТИТЬ ОФОРМЛЕНИЕ</div>
      <div className="splash__scan" aria-hidden="true" />
    </div>,
    document.body,
  );
}
