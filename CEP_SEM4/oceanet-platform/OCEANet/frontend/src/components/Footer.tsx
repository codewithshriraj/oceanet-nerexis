'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Footer() {
  const [logoFailed, setLogoFailed] = useState(false);
  const productLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Reports', href: '/reports' },
  ];

  const platformLinks = [
    { label: 'Data Platform', href: '/data-manager' },
    { label: 'Developer API', href: '/api-hub' },
    { label: 'Intelligence Feed', href: '/news' },
    { label: 'Access Platform', href: '/sign-in' },
  ];

  const launchNotes = [
    'Built for continuous monitoring and public-facing deployment.',
    'Live analytics, reporting, and data access in one system.',
    'Designed for research, policy, and sustainability workflows.',
  ];

  const legalLinks = [
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy Notice', href: '/privacy' },
    { label: 'Terms of Use', href: '/terms' },
  ];

  const openWorkspace = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('nerexis:open-ai-workspace'));
  };

  return (
    <motion.footer 
      className="mt-20 border-t border-white/10 bg-gray-950/80 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 gap-8 mb-8 md:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2"
          >
            <div className="mb-4">
              {!logoFailed ? (
                <img
                  src="/assets/nerexis-logo.png"
                  alt="Nerexis"
                  className="h-[52px] md:h-[88px] w-auto max-w-[260px] md:max-w-[420px] object-contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <h3 className="text-lg font-bold gradient-text">Nerexis</h3>
              )}
            </div>
            <p className="max-w-xl text-sm leading-7 text-gray-300">Nerexis is a public-facing environmental intelligence platform that turns fragmented marine and climate signals into usable monitoring, analytics, and reporting workflows.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {launchNotes.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-gray-300">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h4 className="mb-4 font-bold text-white">Platform</h4>
            <ul className="space-y-2">
              {productLinks.map((item) => (
                <motion.li key={item.label} whileHover={{ x: 5 }}>
                  <Link
                    href={item.href}
                    className="font-medium text-gray-400 transition-colors hover:text-cyan"
                  >
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="mb-4 font-bold text-white">Access</h4>
            <ul className="space-y-2">
              {platformLinks.map((item) => (
                <motion.li key={item.href} whileHover={{ x: 5 }}>
                  <Link href={item.href} className="font-medium text-gray-400 transition-colors hover:text-cyan">
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>

            <div className="mt-8">
              <h4 className="mb-4 font-bold text-white">Trust & Legal</h4>
              <ul className="space-y-2">
                {legalLinks.map((item) => (
                  <motion.li key={item.href} whileHover={{ x: 5 }}>
                    <Link href={item.href} className="font-medium text-gray-400 transition-colors hover:text-cyan">
                      {item.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        <motion.div 
          className="border-t border-white/10 py-8"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              © 2026 Nerexis. Public environmental intelligence platform for monitoring, analytics, and reporting.
            </p>
            <p className="text-center text-sm text-gray-500 md:text-right">
              Live platform surfaces are available through Dashboard, Analytics, Reports, and Developer API.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
}
