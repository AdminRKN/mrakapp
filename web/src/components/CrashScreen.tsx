/* Last line of defence: a render error must not leave a black webview with a dead Telegram button. */
import { Component, type ReactNode } from 'react';
import { setMain, setSecondary } from '../lib/telegram';

export class CrashScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[mrak8] screen crashed', error);
    try { setMain({ visible: false, onClick: null }); setSecondary({ visible: false, onClick: null }); } catch { /* the bridge itself is broken */ }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="screen">
        <div className="empty">
          <span className="lost__sig">● СБОЙ ОФОРМЛЕНИЯ</span>
          <h2 className="display">Связь с центром потеряна</h2>
          <p>Экран не загрузился. Перезапустите мини-апп — пакет и протокол сохранены.</p>
          <button className="btn" onClick={() => location.reload()}>Перезапустить</button>
          <p style={{ fontSize: 10, opacity: 0.5 }}>{error.message}</p>
        </div>
      </section>
    );
  }
}
