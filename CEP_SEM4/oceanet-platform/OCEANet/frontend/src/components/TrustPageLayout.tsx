import { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { GlassCard } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';

type TrustPageLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updatedOn: string;
  children: ReactNode;
};

export default function TrustPageLayout({ eyebrow, title, intro, updatedOn, children }: TrustPageLayoutProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ocean-gradient pb-20">
      <Navbar />
      <FloatingParticles count={8} />

      <section className="relative z-10 px-4 pb-8 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-text-primary md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-text-secondary">{intro}</p>

          <GlassCard className="mt-6 border border-white/10 bg-white/10 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Public Launch Surface</p>
                <p className="mt-2 text-sm text-text-secondary">
                  This page is part of the public trust, contact, and policy experience for Nerexis.
                </p>
              </div>
              <p className="text-sm text-text-secondary">Updated {updatedOn}</p>
            </div>
          </GlassCard>
        </div>
      </section>

      <section className="relative z-10 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">{children}</div>
      </section>

      <Footer />
    </main>
  );
}