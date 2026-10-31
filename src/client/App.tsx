import { useEffect, useState } from 'react';
import type { CatalogResponse, Product, ProductType } from '../shared/catalog';
import { AudioProvider, PlayButton, usePlayback } from './audio';
import { useMotionPreference, useRecordMotion, useReveal } from './motion';
import { Equalizer, Icon, money, ResourceState, useResource } from './ui';

export function App() { return <AudioProvider><Layout /></AudioProvider>; }

function Layout() {
  const motion = useMotionPreference();
  const { current } = usePlayback();
  const slug = /^\/products\/([a-z0-9-]+)\/?$/.exec(window.location.pathname)?.[1];
  return <div className={`app ${current ? 'has-player' : ''}`}>
    <header className="site-header shell">
      <a href="/" className="brand" aria-label="Beatstore — главная"><span className="brand-mark"><i /><i /><i /><i /></span>beatstore<span className="brand-dot">®</span></a>
      <nav className="header-nav" aria-label="Основная навигация"><a className="header-link" href="/#catalog">Каталог <span>↗</span></a><a className="header-link" href="/#about">О проекте</a></nav>
      <button className="motion-toggle" aria-label="Анимации интерфейса" aria-pressed={motion.active} disabled={motion.reduced} title={motion.reduced ? 'Сокращение анимаций включено в системе' : 'Включить или выключить эффекты'} onClick={motion.toggle}><Icon name="motion" size={15} /><span>Эффекты</span><span className="toggle-light" /></button>
    </header>
    {slug ? <Detail slug={slug} /> : <Catalog />}
    <footer className="site-footer shell" id="about"><div className="footer-top"><a href="/" className="brand">beatstore<span className="brand-dot">®</span></a><p>Независимый звук.<br /><span>Для твоих следующих историй.</span></p><a href="/#catalog" className="footer-link">Вернуться к звуку <Icon name="arrow" size={18} /></a></div><div className="footer-bottom"><span><i className="status-dot" /> Учебный проект · Поладов Михаил</span><span>Доступны просмотр и демо. Покупки появятся позже.</span><span className="footer-sign">MADE FOR THE SOUND.</span></div></footer>
  </div>;
}

function Hero() {
  const record = useRecordMotion();
  const { data: featured } = useResource<Product>('/api/products/night-drive');
  const { current, playing } = usePlayback();
  const active = Boolean(featured && current?.id === featured.id && playing);
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><p className="eyebrow hero-eyebrow"><span className="status-dot" /> INDEPENDENT SOUND. UNLIMITED IDEAS.</p><h1 id="hero-title">ЗВУК,<br />КОТОРЫЙ<br /><span>ЦЕПЛЯЕТ.</span><span className="hero-asterisk" aria-hidden="true">✳</span></h1><p className="hero-caption">Биты с характером и драмкиты для новых идей.<br />Твой следующий трек начинается здесь.</p><div className="hero-actions"><a href="#catalog" className="button hero-cta">Найти свой звук <span><Icon name="arrow" size={22} /></span></a><span className="hero-small">НАЖМИ PLAY.<br />ПОЧУВСТВУЙ ВАЙБ.</span></div></div>
      <div className={`record-art ${active ? 'is-playing' : ''}`} ref={record}>
        <div className="art-plane" aria-hidden="true"><div className="art-grid" /><span className="art-caption">BEATSTORE SOUND LAB<br /><b>ORIGINALS — VOL. 01</b></span><span className="art-coordinate">33° / BS</span><div className="record-orbit orbit-one" /><div className="record-orbit orbit-two" /><div className="record-stage"><div className="record"><div className="record-rim" /><div className="record-label"><span className="record-type">INDEPENDENT SOUND</span><strong>bs.</strong><span className="record-hole" /><span className="record-side">SIDE A / ORIGINAL</span></div></div></div><div className="art-sticker">100%<span>СВОЙ ЗВУК</span></div><span className="art-bottom">GOOD SOUND.<br />GREAT STORIES.</span><span className="art-cross">↗</span></div>
        {featured && <div className="hero-preview" id="listen"><PlayButton product={featured} hero /><div><span className="preview-kicker">{active ? 'СЕЙЧАС ИГРАЕТ' : 'НА ПРОСЛУШКУ'}</span><strong>{featured.title}<span> / {featured.genre}</span></strong></div><Equalizer active={active} /></div>}
      </div>
    </section>
    <div className="sound-strip" aria-hidden="true"><span>BEATS WITH CHARACTER</span><i>✳</i><span>СОЗДАВАЙ СВОЁ</span><i>✳</i><span>PRESS PLAY. FEEL SOMETHING.</span><i>✳</i><span>NO ORDINARY SOUND</span></div>
  </>;
}

function Catalog() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ProductType | ''>('');
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (type) params.set('type', type);
  const resource = useResource<CatalogResponse>(`/api/products?${params}`);
  const reveal = useReveal(resource.data);
  return <main className="shell">
    <Hero />
    <section id="catalog" className="catalog" aria-labelledby="catalog-title" ref={reveal}>
      <div className="section-title"><div><p className="eyebrow muted">01 / THE SOUND COLLECTION</p><h2 id="catalog-title">Каталог<span className="heading-dot" aria-hidden="true">.</span></h2></div><div className="section-note"><span className="count">{resource.loading ? '…' : String(resource.data?.total ?? 0).padStart(2, '0')}</span><span>релизов<br />в твоём распоряжении</span></div></div>
      <div className="catalog-toolbar"><div className="tabs" role="group" aria-label="Тип товара">{([['', 'Все'], ['beat', 'Биты'], ['drumkit', 'Драмкиты']] as const).map(([value, label]) => <button key={value} aria-pressed={type === value} className={type === value ? 'active' : ''} onClick={() => setType(value)}>{label}<span className="tab-dot" /></button>)}</div><label className="search"><Icon name="search" size={19} /><input type="search" placeholder="Найти свой следующий трек…" aria-label="Поиск по названию" maxLength={140} value={query} onChange={e => setQuery(e.target.value)} /><span className="search-hint">SEARCH</span></label></div>
      <ResourceState {...resource} />
      {!resource.loading && !resource.error && resource.data && (resource.data.items.length ? <div className="product-grid">{resource.data.items.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="state-box"><span className="state-icon"><Icon name="search" size={28} /></span><h3>Пока ничего не нашлось</h3><p>Попробуйте другое название или посмотрите весь каталог.</p><button className="button" onClick={() => { setQuery(''); setType(''); }}>Сбросить поиск <Icon name="arrow" size={17} /></button></div>)}
    </section>
    <section className="catalog-note"><div><p className="eyebrow">СЛУШАЙ. ВДОХНОВЛЯЙСЯ. СОЗДАВАЙ.</p><h2>ТВОЙ ВАЙБ.<br />ТВОИ ПРАВИЛА.</h2></div><div className="note-right"><span className="note-asterisk" aria-hidden="true">✳</span><p>Сначала почувствуй звук.<br />У каждого релиза есть демо,<br />а у каждого варианта — свой комплект.</p></div></section>
  </main>;
}

function ProductCard({ product: p, index }: { product: Product; index: number }) {
  const { current, playing } = usePlayback();
  const active = current?.id === p.id && playing;
  return <article className={`product-card ${active ? 'on-air' : ''}`} data-reveal="ready">
    <div className="cover-wrap"><a href={`/products/${p.slug}`} tabIndex={-1} aria-hidden="true"><img className="cover" src={p.coverUrl} alt="" width="640" height="640" decoding="async" loading={index < 3 ? 'eager' : 'lazy'} /></a><div className="cover-topline"><span className="cover-tag">{p.type === 'beat' ? 'BEAT' : 'DRUMKIT'}</span><span className="cover-number">BS / {String(index + 1).padStart(2, '0')}</span></div><div className="cover-bottom"><span className="cover-sound"><Equalizer active={active} /><span>{active ? 'СЕЙЧАС ИГРАЕТ' : 'СЛУШАТЬ ДЕМО'}</span></span><PlayButton product={p} /></div></div>
    <div className="card-copy"><div className="card-topline"><h3><a href={`/products/${p.slug}`}>{p.title}</a></h3><span className="card-arrow" aria-hidden="true">↗</span></div><p className="product-meta"><span className="genre-tag">{p.genre}</span>{p.type === 'beat' && <><span>{p.bpm} BPM</span><span>{p.musicalKey}</span></>}</p><div className="card-bottom"><span className="card-price">от <strong>{money(p.variants[0]!.price)}</strong></span><a href={`/products/${p.slug}`} className="details-link" aria-label={`Подробнее о ${p.title}`}>Подробнее <Icon name="arrow" size={17} /></a></div></div>
  </article>;
}

const formatNotes = {
  mp3: 'Один MP3-файл бита. Другие форматы в этот комплект не входят.',
  wav: 'Один WAV-файл бита. Другие форматы в этот комплект не входят.',
  trackout: 'Один ZIP-архив с отдельными WAV-дорожками бита.',
  exclusive: 'Один ZIP-архив проекта. В учебном каталоге — project.json и исходные WAV-дорожки.',
  drumkit: 'Один ZIP-архив с ударными звуками. Состав набора описан в карточке.',
};

function Detail({ slug }: { slug: string }) {
  const resource = useResource<Product>(`/api/products/${slug}`);
  const product = resource.data;
  const { current, playing } = usePlayback();
  const active = current?.id === product?.id && playing;
  useEffect(() => { document.title = product ? `${product.title} — Beatstore` : 'Товар — Beatstore'; }, [product]);
  return <main className="shell detail"><a className="back-link" href="/#catalog"><Icon name="back" size={17} /> Вернуться в каталог<span>BACK TO THE SOUND</span></a><ResourceState {...resource} />{!resource.loading && !resource.error && product && <div className="detail-layout"><div className={`detail-cover ${active ? 'on-air' : ''}`}><div className="detail-image"><img src={product.coverUrl} alt={`Обложка ${product.title}`} width="640" height="640" /><span className="detail-image-tag">BEATSTORE ORIGINALS</span><span className="detail-image-mark" aria-hidden="true">bs.</span></div><div className="detail-listen"><PlayButton product={product} /><span>{active ? 'Сейчас играет' : 'Послушать демо'}<small>Почувствуй звук перед выбором</small></span><Equalizer active={active} /></div><p className="detail-fineprint">ORIGINAL SOUND / INDEPENDENT IDEAS</p></div><div className="detail-copy"><p className="eyebrow accent"><span className="status-dot" />{product.type === 'beat' ? 'АВТОРСКИЙ БИТ' : 'НАБОР УДАРНЫХ'}</p><h1>{product.title}<span className="heading-dot" aria-hidden="true">.</span></h1><div className="detail-meta"><span>{product.genre}</span>{product.type === 'beat' && <><span>{product.bpm} BPM</span><span>{product.musicalKey}</span></>}</div><p className="description">{product.description}</p><div className="variant-heading"><h2>Варианты и комплекты</h2><span>ЧТО ВНУТРИ ↙</span></div><div className="variants">{product.variants.map((v, index) => <details className="variant" key={v.kind}><summary><span className="variant-number">0{index + 1}</span><span className="variant-info"><strong>{v.label}</strong><span>{v.bundle}</span></span><strong className="variant-price">{money(v.price)}</strong><Icon name="plus" size={16} /></summary><p className="variant-description">{formatNotes[v.kind]}</p></details>)}</div><div className="availability"><Icon name="note" size={19} /><p>Сейчас доступны просмотр и прослушивание.<br /><span>Оформление покупки и лицензии появятся позже.</span></p></div></div></div>}</main>;
}
