import type { NewsHero as HeroData } from './types';

type Props = {
  hero: HeroData;
};

const readable = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

export default function NewsHero({ hero }: Props) {
  const hasImage = Boolean(hero.image);

  return (
    <section className="relative w-full overflow-hidden rounded-2xl border border-primary/20 shadow-glow h-full min-h-[340px] md:min-h-[420px]">
      {hasImage ? (
        <a href={hero.image!} target="_blank" rel="noreferrer" className="absolute inset-0 block">
          <img
            src={hero.image!}
            alt={hero.title}
            className="absolute inset-0 h-full w-full cursor-zoom-in object-cover"
            loading="eager"
            decoding="async"
          />
        </a>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.32),transparent_45%),linear-gradient(135deg,rgba(8,47,73,0.95),rgba(3,7,18,0.98))]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/55 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
        <div className="flex flex-wrap gap-2 text-xs md:text-sm mb-3">
          <span className="badge badge-info">{hero.category}</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1">{hero.location}</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1">By {hero.author}</span>
        </div>

        <h1 className="text-2xl md:text-4xl font-bold leading-tight max-w-4xl">{hero.title}</h1>
        <p className="mt-3 text-sm md:text-base text-deep-twilight max-w-3xl">{hero.summary}</p>
        <p className="mt-4 text-xs md:text-sm text-deep-twilight">
          Published: {readable(hero.publishDate)} • Last updated: {readable(hero.lastUpdated)}
        </p>
        {!hasImage ? <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/80">Editorial cover image unavailable</p> : null}
      </div>
    </section>
  );
}
