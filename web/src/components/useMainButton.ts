import { useEffect, useRef } from 'react';
import { resetButtons, setMain, setSecondary, type ButtonState } from '../lib/telegram';

type Btn = Partial<ButtonState> | null;

/**
 * Declarative native buttons: pass the desired state every render; the hook pushes changes to
 * Telegram (or the emulated bar) and hides both buttons when the screen unmounts.
 * Handlers are read through a ref, so they always see fresh state.
 */
export function useMainButton(main: Btn, sec: Btn = null) {
  const ref = useRef({ main, sec });
  ref.current = { main, sec };
  const key = JSON.stringify([main && { ...main, onClick: !!main.onClick }, sec && { ...sec, onClick: !!sec.onClick }]);
  useEffect(() => {
    const m = ref.current.main, s = ref.current.sec;
    setMain(m ? { visible: true, active: true, progress: false, shine: false, color: '#E0241B', textColor: '#FFFFFF', ...m, onClick: m.onClick ? () => ref.current.main?.onClick?.() : null } : { visible: false, onClick: null });
    // stacked by default: side by side each button gets half the width and Telegram cuts the text («ОФОРМИТЬ ПРОТ…»)
    setSecondary(s ? { visible: true, active: true, color: '#1C1C1C', textColor: '#F1ECE1', position: 'top', ...s, onClick: s.onClick ? () => ref.current.sec?.onClick?.() : null } : { visible: false, onClick: null });
  }, [key]);
  useEffect(() => () => resetButtons(), []);
}
