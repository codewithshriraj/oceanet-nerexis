import type { Metadata } from 'next';
import { GlassCard } from '@/components/Cards';
import TrustPageLayout from '@/components/TrustPageLayout';

export const metadata: Metadata = {
  title: 'Terms | Nerexis',
  description: 'Terms of use for the Nerexis public platform.',
};

const updatedOn = 'March 16, 2026';

const termsSections = [
  {
    title: 'Platform scope',
    points: [
      'Nerexis is an environmental intelligence platform for monitoring, analytics, reporting, and AI-assisted workflows.',
      'Platform outputs are informational and operational in nature. They should support review and decision-making, not replace independent validation where scientific, legal, policy, or safety-critical judgment is required.',
    ],
  },
  {
    title: 'Acceptable use',
    points: [
      'You may use the platform only for lawful purposes and in ways that do not disrupt, abuse, or degrade the service.',
      'You must not upload malicious files, attempt to bypass access controls, scrape restricted areas, or misuse generated outputs in a misleading way.',
      'You should upload only data that you are authorized to use and share through the platform.',
    ],
  },
  {
    title: 'Accounts and access',
    points: [
      'Users are responsible for protecting their credentials and for activity performed through their accounts.',
      'The platform operator may suspend, limit, or revoke access to protect the service, comply with legal requirements, or respond to misuse.',
    ],
  },
  {
    title: 'Data, reports, and outputs',
    points: [
      'You remain responsible for the legality, accuracy, and permitted use of data submitted to the platform.',
      'Generated reports, forecasts, and AI outputs may contain limitations, model assumptions, or errors and should be reviewed before external publication or critical use.',
      'Shared report links should be treated as intentional disclosures to the recipients who receive them.',
    ],
  },
  {
    title: 'Availability and legal completion',
    points: [
      'Unless separately agreed in writing, the platform is provided without a guaranteed uptime, service level, or jurisdiction-specific warranty statement.',
      'Before worldwide public launch, the operator should finalize governing law, operator identity, dispute handling, and contact details for legal notices.',
    ],
  },
];

export default function TermsPage() {
  return (
    <TrustPageLayout
      eyebrow="Terms"
      title="Terms of Use"
      intro="These terms define the practical rules for using the current public-facing Nerexis platform. They are designed to reduce ambiguity around acceptable use, platform outputs, and operator responsibilities before full public launch."
      updatedOn={updatedOn}
    >
      {termsSections.map((section) => (
        <GlassCard key={section.title} className="border border-white/10 bg-white/10 p-6">
          <h2 className="text-xl font-semibold text-text-primary">{section.title}</h2>
          <div className="mt-4 space-y-3">
            {section.points.map((point) => (
              <div key={point} className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
                <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-cyan" />
                <p>{point}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </TrustPageLayout>
  );
}