import { createRoot } from 'react-dom/client';
import '@fontsource-variable/roboto-condensed/wght.css';
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/tokens.css';
import './styles/app.css';
import { App, initialRoute, parse, reload } from './App';
import { CrashScreen } from './components/CrashScreen';
import { initDj } from './components/DjSet';
import { initGrain } from './lib/fx';
import { useRouter } from './lib/router';
import { restore, useStore } from './lib/store';
import { initTelegram, startParam } from './lib/telegram';

initTelegram();
initGrain();
initDj();

const q = new URLSearchParams(location.search);
const start = initialRoute(startParam);
const route = parse(start);
const isRoot = ['catalog', 'bag', 'dossier', 'admin'].includes(route.name);
useRouter.setState({ route, stack: isRoot ? [start] : ['#/', start], lastCase: route.name === 'case' ? route.params.id : null });
try { history.replaceState(null, '', location.pathname + location.search + start); } catch { /* sandboxed */ }

void (async () => {
  await restore();
  const ready = reload();
  const visits = useStore.getState().visits;
  const splashMode = q.get('splash') === '0' ? 'off' : q.get('splash') === 'full' || visits === 0 ? 'full' : 'short';
  createRoot(document.getElementById('root')!).render(<CrashScreen><App ready={ready} splashMode={splashMode} /></CrashScreen>);
})();
