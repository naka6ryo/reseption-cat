import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { initVoiceVox, preloadTTS } from '../hooks/useSpeech';

export default function App() {
  const { search } = useLocation();
  useEffect(() => {
    // 事前初期化＋短文の事前生成で初回遅延を軽減
    initVoiceVox().finally(() => {
  preloadTTS('いらっしゃいませ！').catch(()=>{});
  preloadTTS('ありがとうございます！').catch(()=>{});
    });
  }, []);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <h1 className="font-bold text-lg">Reception Cat</h1>
        <nav className="flex gap-3 text-sm">
          <NavLink to={{ pathname: '/display', search }} className={({isActive})=> isActive? 'font-bold underline' : ''}>/display</NavLink>
          <NavLink to={{ pathname: '/setup', search }} className={({isActive})=> isActive? 'font-bold underline' : ''}>/setup</NavLink>
        </nav>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}