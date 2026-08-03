import type { Metadata } from 'next';
import { GlassCard } from '@/components/Cards';
import TrustPageLayout from '@/components/TrustPageLayout';

export const metadata: Metadata = {
  title: 'Privacy | Nerexis',
  description: 'Privacy notice for the Nerexis public platform.',
};

const updatedOn = 'March 16, 2026';

const privacySections = [
  {
    title: 'Information the platform may process',
    points: [
      'Account information such as name, email address, and authentication-related data needed to manage sign-in and role-based access.',
      'Operational usage data such as session activity, requests to platform features, and basic service diagnostics used to keep the application working.',
      'Datasets, uploaded files, generated reports, and workspace content submitted through the platform as part of monitoring and analysis workflows.',
      'Cookies or similar session mechanisms used to keep users signed in and maintain platform access state.',
    ],
  },
  {
    title: 'Why this information is used',
    points: [
      'To authenticate users, enforce access controls, and operate the platform securely.',
      'To run analytics, generate reports, support AI-assisted workflows, and maintain public-facing platform functionality.',
      'To monitor system performance, investigate failures, and protect the platform from misuse or abuse.',
    ],
  },
  {
    title: 'Sharing and public exposure',
    points: [
      'Generated reports or shared links may be visible to the people they are intentionally shared with.',
      'Infrastructure or hosting providers used to run the platform may process data required to deliver the service.',
      'This platform should not be used to upload personal, confidential, or restricted data unless the operator has explicitly approved that use case.',
    ],
  },
  {
    title: 'Deployment-specific updates still required',
    points: [
      'Before public launch, the deployment operator should add legal entity information, retention periods, subprocessor disclosures, jurisdiction-specific rights, and a monitored privacy contact email.',
      'This notice describes current platform behavior at a high level, but public production use should include location-specific legal review.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <TrustPageLayout
      eyebrow="Privacy"
      title="Privacy Notice"
      intro="This notice explains, at a practical level, how the current Nerexis platform may process user, operational, and uploaded data. It is written to support a public deployment, but operator-specific legal details still need to be finalized before launch."
      updatedOn={updatedOn}
    >
      {privacySections.map((section) => (
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