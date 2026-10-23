import { useEffect, useState } from 'react';
import { subjectNo } from '@mrak8/shared';
import { api } from './lib/api';
import { parse, useRouter, type Route } from './lib/router';
import { set, useStore } from './lib/store';
import { emulated, inTG, setChrome, tgUser } from './lib/telegram';
import { CtrlBand, EmuBottom, Header, Overlays, TabBar, useCtrl } from './components/shell';
import { Bag } from './screens/Bag';
import { Booked } from './screens/Booked';
import { CaseScreen } from './screens/CaseScreen';
import { Catalog } from './screens/Catalog';
import { Dossier, Gate, Lost } from './screens/Misc';
import { Protocol } from './screens/Protocol';
import { Splash } from './screens/Splash';
import { ControlRoom } from './screens/admin/ControlRoom';
import { Editor } from './screens/admin/Editor';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'case': return <CaseScreen id={route.params.id} />;
    case 'bag': return <Bag />;
    case 'protocol': return <Protocol />;
    case 'booked': return <Booked no={route.params.no} />;
    case 'dossier': return <Dossier />;
    case 'admin': return <ControlRoom tab={route.params.tab} />;
    case 'editor': return <Editor id={route.params.id} />;
    case 'lost': return <Lost />;
    default: return null;
  }
}

export async function reload() {
  try {
    const boot = await api.bootstrap();
    set({ boot, bootError: null, height: useStore.getState().height ?? boot.me.height });
  } catch (e) {
    set({ bootError: (e as Error).message });
  }
}

export function App({ ready, splashMode }: { ready: Promise<unknown>; splashMode: 'full' | 'short' | 'off' }) {
  const route = useRouter((s) => s.route);
  const boot = useStore((s) => s.boot);
  const bootError = useStore((s) => s.bootError);
  const [splash, setSplash] = useState(splashMode !== 'off');
  const gate = !inTG && !emulated;
  // admin tabs share one screen instance; everything else remounts per path
  const key = route.name === 'admin' ? 'admin' : route.path;
  const ctrl = useCtrl();
  useEffect(() => {
    document.documentElement.classList.toggle('is-ctrl', ctrl);
    setChrome(ctrl);
  }, [ctrl]);
  return (
    <>
      <div className="app">
        <Header />
        {ctrl && <CtrlBand />}
        <main className="stage" id="stage">
          {gate ? <Gate /> : bootError && !boot ? (
            <Lost message={bootError} onRetry={reload} />
          ) : (
            <>
              {boot && <Catalog active={route.name === 'catalog'} />}
              {boot && route.name !== 'catalog' && <Screen key={key} route={route} />}
            </>
          )}
        </main>
        <TabBar />
      </div>
      <EmuBottom />
      <Overlays />
      {splash && !gate && (
        <Splash
          short={splashMode === 'short'}
          subject={boot?.me.subjectNo ?? subjectNo(tgUser.id)}
          ready={ready}
          onDone={() => { setSplash(false); set((s) => ({ visits: s.visits + 1 })); }}
        />
      )}
    </>
  );
}

export const initialRoute = (startParam: string) => {
  if (/^product_\d+/.test(startParam)) return '#/case/' + startParam.slice(8);
  if (/^drop_\d+/.test(startParam)) return '#/case/' + startParam.slice(5);
  if (/^order_/.test(startParam)) return '#/booked/' + startParam.slice(6);
  if (startParam === 'admin') return '#/admin';
  return location.hash.startsWith('#/') ? location.hash : '#/';
};
export { parse };
