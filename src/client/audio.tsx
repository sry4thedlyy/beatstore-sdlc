import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Product } from '../shared/catalog';
import { Equalizer, Icon } from './ui';

interface Playback {
  current?: Product;
  playing: boolean;
  toggle(product: Product): Promise<void>;
}
const PlaybackContext = createContext<Playback | null>(null);
export function usePlayback() { return useContext(PlaybackContext)!; }

export function AudioProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const selected = useRef<Product | undefined>(undefined);
  const [current, setCurrent] = useState<Product>();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const toggle = useCallback(async (product: Product) => {
    const player = audio.current!;
    setError('');
    if (selected.current?.id === product.id && !player.paused) { player.pause(); return; }
    if (selected.current?.id !== product.id) {
      selected.current = product;
      setCurrent(product);
      player.src = product.demoUrl;
    }
    try { await player.play(); }
    catch (failure) {
      if (selected.current?.id === product.id && !(failure instanceof DOMException && failure.name === 'AbortError')) {
        setError('Демо не удалось воспроизвести. Попробуйте ещё раз.');
      }
    }
  }, []);
  const close = () => {
    audio.current!.pause();
    audio.current!.removeAttribute('src');
    audio.current!.load();
    selected.current = undefined; setCurrent(undefined); setError('');
  };
  const value = useMemo(() => ({ current, playing, toggle }), [current, playing, toggle]);
  return <PlaybackContext.Provider value={value}>
    {children}
    <audio ref={audio} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { if (selected.current) setError('Демо недоступно. Попробуйте выбрать его ещё раз.'); }} />
    {current && <Player current={current} playing={playing} toggle={toggle} audio={audio} error={error} close={close} />}
  </PlaybackContext.Provider>;
}

export function PlayButton({ product, className = '', hero = false }: { product: Product; className?: string; hero?: boolean }) {
  const { current, playing, toggle } = usePlayback();
  const active = current?.id === product.id && playing;
  const label = hero ? `${active ? 'Приостановить' : 'Слушать'} главный трек ${product.title}` : `${active ? 'Приостановить' : 'Слушать демо'} ${product.title}`;
  return <button className={`play-button ${active ? 'is-playing' : ''} ${className}`} onClick={() => void toggle(product)} aria-label={label}><Icon name={active ? 'pause' : 'play'} size={22} /></button>;
}

const clock = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
function Player({ current, playing, toggle, audio, error, close }: Playback & { current: Product; audio: RefObject<HTMLAudioElement | null>; error: string; close(): void }) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // High-frequency media updates stay in Player; Catalog and Hero do not re-render.
  useEffect(() => {
    const player = audio.current!;
    const updateTime = () => setTime(player.currentTime || 0);
    const updateDuration = () => setDuration(Number.isFinite(player.duration) ? player.duration : 0);
    updateTime(); updateDuration();
    player.addEventListener('timeupdate', updateTime);
    player.addEventListener('loadedmetadata', updateDuration);
    player.addEventListener('durationchange', updateDuration);
    return () => {
      player.removeEventListener('timeupdate', updateTime);
      player.removeEventListener('loadedmetadata', updateDuration);
      player.removeEventListener('durationchange', updateDuration);
    };
  }, [audio, current.id]);
  return <aside className={`player ${playing ? 'is-playing' : ''}`} aria-label="Аудиоплеер">
    <div className="player-inner">
      <div className="player-art"><img src={current.coverUrl} width="48" height="48" alt="" /><Equalizer active={playing} /></div>
      <div className="player-name"><span className="player-kicker">{playing ? 'СЕЙЧАС ИГРАЕТ' : 'НА ПАУЗЕ'}</span><strong>{current.title}</strong><span>Демо · {current.genre}</span></div>
      <button className="play-button player-toggle" onClick={() => void toggle(current)} aria-label={`${playing ? 'Приостановить' : 'Слушать демо'} ${current.title}`}><Icon name={playing ? 'pause' : 'play'} /></button>
      <div className="player-timeline"><span className="player-time">{clock(time)}</span><input className="seek" type="range" min="0" max={duration || 1} step="0.05" value={Math.min(time, duration || 1)} aria-label="Позиция воспроизведения" onInput={e => { if (audio.current && duration) { const position = Number(e.currentTarget.value); audio.current.currentTime = position; setTime(position); } }} /><span className="player-time">{clock(duration)}</span></div>
      <span className="player-demo-tag">DEMO PREVIEW</span>
      <button className="icon-button player-close" onClick={close} aria-label="Закрыть плеер"><Icon name="close" size={18} /></button>
    </div>
    {error && <p role="alert" className="audio-error">{error}</p>}
  </aside>;
}
