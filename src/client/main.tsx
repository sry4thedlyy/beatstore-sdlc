import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CatalogResponse, Product, ProductType } from '../shared/catalog';
import './style.css';

const money = (value: string) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(Number(value));
const clock = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
type IconName = 'play' | 'pause' | 'search' | 'arrow' | 'back' | 'note';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths = {
    play: <path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    note: <><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function useResource<T>(url: string) {
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

function App() {
  const audio = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<Product>();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState('');
  async function toggle(product: Product) {
    const player = audio.current!;
    setAudioError('');
    if (current?.id === product.id && !player.paused) { player.pause(); return; }
    if (current?.id !== product.id) {
      setCurrent(product); setTime(0); setDuration(0); player.src = product.demoUrl;
    }
    try { await player.play(); } catch { setAudioError('Демо не удалось воспроизвести. Попробуйте ещё раз.'); }
  }
  const slug = /^\/products\/([a-z0-9-]+)\/?$/.exec(window.location.pathname)?.[1];
  const playButton = (product: Product, className = '') => <button className={`play-button ${className}`} onClick={() => void toggle(product)} aria-label={`${current?.id === product.id && playing ? 'Приостановить' : 'Слушать демо'} ${product.title}`}><Icon name={current?.id === product.id && playing ? 'pause' : 'play'} /></button>;
  return <>
    <header className="site-header shell">
      <a href="/" className="brand" aria-label="Beatstore — главная"><span className="brand-mark"><i /><i /><i /><i /></span>beatstore<span className="brand-dot">®</span></a>
      <a className="header-link" href="/#catalog">Каталог <Icon name="arrow" size={17} /></a>
      <span className="study-tag"><span /> Учебный проект</span>
    </header>
    {slug ? <Detail slug={slug} playButton={playButton} /> : <Catalog playButton={playButton} />}
    <footer className={`site-footer shell ${current ? 'with-player' : ''}`}><span>beatstore <span className="muted">/ авторский звук</span></span><span>Демо можно слушать. Покупки появятся на следующем этапе.</span></footer>
    <audio ref={audio} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={() => setTime(audio.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(audio.current?.duration || 0)} onError={() => setAudioError('Демо недоступно. Попробуйте выбрать его ещё раз.')} />
    {current && <aside className="player" aria-label="Аудиоплеер">
      <div className="player-inner shell"><img src={current.coverUrl} alt="" /><div className="player-name"><strong>{current.title}</strong><span>{audioError || 'Демо · учебный материал'}</span></div>
        {playButton(current, 'player-toggle')}
        <span className="player-time">{clock(time)}</span><input className="seek" type="range" min="0" max={duration || 1} step="0.05" value={Math.min(time, duration || 1)} aria-label="Позиция воспроизведения" onInput={e => { if (audio.current && duration) { const position = Number(e.currentTarget.value); audio.current.currentTime = position; setTime(position); } }} /><span className="player-time">{clock(duration)}</span>
      </div>{audioError && <p role="alert" className="audio-error">{audioError}</p>}
    </aside>}
  </>;
}

type PlayButton = (product: Product, className?: string) => React.ReactNode;
function State({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (error) return <div className="state-box" role="alert"><Icon name="note" size={30} /><h2>Не получилось загрузить</h2><p>{error}</p><button className="button" onClick={retry}>Попробовать снова <Icon name="arrow" size={17} /></button></div>;
  if (loading) return <div className="loading" role="status"><span className="spinner" /> Загружаем звук…</div>;
  return null;
}

function Catalog({ playButton }: { playButton: PlayButton }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ProductType | ''>('');
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (type) params.set('type', type);
  const resource = useResource<CatalogResponse>(`/api/products?${params}`);
  return <main className="shell">
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="tiny-line" /> BEATS & DRUMKITS</p><h1 id="hero-title">Твой звук.<br /><span>Твоя история.</span></h1><p className="hero-caption">Биты с характером. Звуки для новых идей.<br />Выбирай, слушай, создавай.</p><a href="#catalog" className="hero-link">Найти свой звук <Icon name="arrow" /></a></div><div className="record-art" aria-hidden="true"><span className="art-caption">INDEPENDENT SOUND / VOL. 01</span><div className="record"><div className="record-label"><span>BS</span><small>33⅓ RPM</small></div></div><span className="art-bottom">PRESS PLAY. MAKE SOMETHING.</span><span className="art-cross">+</span></div></section>
    <section id="catalog" className="catalog" aria-labelledby="catalog-title"><div className="section-title"><div><p className="eyebrow muted">ВЫБЕРИ НАСТРОЕНИЕ</p><h2 id="catalog-title">Каталог<span className="count">{resource.loading ? '…' : resource.data?.total ?? '—'}</span></h2></div><span className="section-note"><span className="status-dot" /> Авторские демоматериалы</span></div>
      <div className="catalog-toolbar"><div className="tabs" role="group" aria-label="Тип товара">{([['', 'Все'], ['beat', 'Биты'], ['drumkit', 'Драмкиты']] as const).map(([value, label]) => <button key={value} aria-pressed={type === value} className={type === value ? 'active' : ''} onClick={() => setType(value)}>{label}</button>)}</div><label className="search"><Icon name="search" size={19} /><input type="search" placeholder="Найти по названию" aria-label="Поиск по названию" maxLength={140} value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <State {...resource} />
      {!resource.loading && !resource.error && resource.data && (resource.data.items.length ? <div className="product-grid">{resource.data.items.map((p, index) => <article className="product-card" key={p.id}><div className="cover-wrap"><a href={`/products/${p.slug}`} tabIndex={-1} aria-hidden="true"><img className="cover" src={p.coverUrl} alt="" loading={index < 3 ? 'eager' : 'lazy'} /></a><span className="cover-tag">{p.type === 'beat' ? 'BEAT' : 'DRUMKIT'}</span>{playButton(p)}</div><div className="card-topline"><h3><a href={`/products/${p.slug}`}>{p.title}</a></h3><span className="card-number">{String(index + 1).padStart(2, '0')}</span></div><p className="product-meta">{p.genre}{p.type === 'beat' && <> <span>·</span> {p.bpm} BPM <span>·</span> {p.musicalKey}</>}</p><div className="card-bottom"><span>от <strong>{money(p.variants[0]!.price)}</strong></span><a href={`/products/${p.slug}`} className="details-link" aria-label={`Подробнее о ${p.title}`}>Подробнее <Icon name="arrow" size={17} /></a></div></article>)}</div> : <div className="state-box"><Icon name="search" size={30} /><h3>Пока ничего не нашлось</h3><p>Попробуйте другое название или посмотрите весь каталог.</p><button className="button" onClick={() => { setQuery(''); setType(''); }}>Сбросить поиск <Icon name="arrow" size={17} /></button></div>)}
    </section><section className="catalog-note"><Icon name="note" size={22} /><p>Сначала послушай.<br /><span>У каждого товара есть демо, а у каждого варианта — свой комплект файлов.</span></p><span className="note-sign">MAKE IT YOURS ↗</span></section>
  </main>;
}

function Detail({ slug, playButton }: { slug: string; playButton: PlayButton }) {
  const resource = useResource<Product>(`/api/products/${slug}`);
  const product = resource.data;
  useEffect(() => { document.title = product ? `${product.title} — Beatstore` : 'Товар — Beatstore'; }, [product]);
  return <main className="shell detail"><a className="back-link" href="/#catalog"><Icon name="back" size={17} /> Вернуться в каталог</a><State {...resource} />{!resource.loading && !resource.error && product && <><div className="detail-layout"><div className="detail-cover"><img src={product.coverUrl} alt={`Обложка ${product.title}`} /><div className="detail-listen">{playButton(product)}<span>Послушать демо<small>Перед тем как выбрать свой вариант</small></span></div></div><div className="detail-copy"><p className="eyebrow accent">{product.type === 'beat' ? 'АВТОРСКИЙ БИТ' : 'НАБОР УДАРНЫХ'}</p><h1>{product.title}</h1><p className="detail-meta">{product.genre}{product.type === 'beat' && <> <span>·</span> {product.bpm} BPM <span>·</span> {product.musicalKey}</>}</p><p className="description">{product.description}</p><h2>Варианты и комплекты</h2><div className="variants">{product.variants.map(v => <div className="variant" key={v.kind}><div><strong>{v.label}</strong><span>{v.bundle}</span></div><strong>{money(v.price)}</strong></div>)}</div><div className="availability"><span className="status-dot" /><p>Сейчас доступны просмотр и прослушивание.<br /><span>Оформление покупки и лицензии появятся позже.</span></p></div></div></div></>}</main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
