import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassCard } from '@/components/Cards';
import TrustPageLayout from '@/components/TrustPageLayout';

export const metadata: Metadata = {
  title: 'Contact | Nerexis',
  description: 'Contact and support information for the Nerexis public platform.',
};

const updatedOn = 'March 16, 2026';

const supportEmail = 'shriraj.erwadkar20@gmail.com';
const supportPhone = '+91-7588490797';

const contactChannels = [
  {
    title: 'General platform inquiries',
    description: 'Use this route for deployment questions, research collaboration, product interest, or public launch coordination.',
  },
  {
    title: 'Account and access support',
    description: 'Use this route for sign-in issues, role access questions, or requests related to platform availability.',
  },
  {
    title: 'Privacy and legal requests',
    description: 'Use this route for privacy notices, terms questions, data handling concerns, or public deployment policy requests.',
  },
];

export default function ContactPage() {
  return (
    <TrustPageLayout
      eyebrow="Contact"
      title="How to Reach the Platform Team"
      intro="Use the contact route below for platform, access, privacy, or public deployment questions. For a public launch, this page should always expose a monitored contact channel."
      updatedOn={updatedOn}
    >
      <GlassCard className="border border-white/10 bg-white/10 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Primary Contact</p>
        <p className="mt-3 text-2xl font-semibold text-text-primary">{supportEmail}</p>
        <p className="mt-1 text-lg font-semibold text-text-primary">{supportPhone}</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
          This email and phone number are the primary public contact channels for this deployment.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/15"
          >
            Email the platform team
          </a>
          <a
            href={`tel:${supportPhone.replace(/[^+\d]/g, '')}`}
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/15"
          >
            Call support
          </a>
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-3">
        {contactChannels.map((item) => (
          <GlassCard key={item.title} className="border border-white/10 bg-white/10 p-5">
            <h2 className="text-lg font-semibold text-text-primary">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="border border-white/10 bg-white/10 p-6">
        <h2 className="text-xl font-semibold text-text-primary">Before you launch publicly</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
          <p>Identify the operating entity for this deployment and make sure privacy and terms requests are handled through a defined process.</p>
          <p>For access-related requests, users can still go through the existing secure entry flow on the <Link href="/sign-in" className="font-semibold text-cyan hover:text-text-primary">sign-in page</Link>.</p>
        </div>
      </GlassCard>
    </TrustPageLayout>
  );
}