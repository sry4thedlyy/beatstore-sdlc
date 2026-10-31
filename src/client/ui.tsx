import { useEffect, useState } from 'react';

export const money = (() => {
  const formatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
  return (value: string) => formatter.format(Number(value));
})();

type IconName = 'play' | 'pause' | 'search' | 'arrow' | 'back' | 'note' | 'close' | 'motion' | 'plus';
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths = {
    play: <path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none" />,
    pause: <path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    note: <><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    motion: <path d="m13 2-9 12h7l-1 8 10-13h-7z" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Equalizer({ active = false }: { active?: boolean }) {
  return <span className={`equalizer ${active ? 'is-playing' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}

export function WaveMark() {
  return <svg className="wave-mark" viewBox="0 0 68 40" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true"><path d="M4 17v6M12 12v16M20 6v28M28 13v14M36 3v34M44 9v22M52 14v12M60 11v18" /></svg>;
}

export function useResource<T>(url: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(res.status === 404 ? 'Товар не найден или больше не опубликован.' : 'Не удалось загрузить каталог. Проверьте соединение и попробуйте ещё раз.');
        const value = await res.json() as T;
        if (!controller.signal.aborted) setData(value);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, attempt]);
  return { data, error, loading, retry: () => setAttempt(n => n + 1) };
}

export function ResourceState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (error) return <div className="state-box" role="alert"><span className="state-icon"><Icon name="note" size={28} /></span><h2>Не получилось загрузить</h2><p>{error}</p><button className="button" onClick={retry}>Попробовать снова <Icon name="arrow" size={17} /></button></div>;
  if (loading) return <div className="loading" role="status"><Equalizer active /><span>Загружаем звук…</span></div>;
  return null;
}
