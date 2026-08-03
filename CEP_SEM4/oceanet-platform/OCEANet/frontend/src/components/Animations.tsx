'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

interface FloatingParticlesProps {
  count?: number;
}

// Pseudo-random function using index for deterministic values
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function FloatingParticles({ count = 30 }: FloatingParticlesProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const particles = useMemo(() => {
    const colors = [
      'var(--color-marine-slate)',
      'var(--color-neon-coral)',
      'var(--color-coral)',
      'var(--color-seafoam)',
      'var(--color-bioluminescent)'
    ];
    return Array.from({ length: count }, (_, i) => {
      // Use seeded random for consistent values between server and client
      return {
        id: i,
        color: colors[i % colors.length],
        duration: 10 + seededRandom(i * 7) * 8,
        delay: seededRandom(i * 13) * 3,
        left: seededRandom(i * 2) * 100,
        top: seededRandom(i * 3) * 100,
        width: 2 + seededRandom(i * 5) * 4,
        height: 2 + seededRandom(i * 11) * 4,
        blurSize: 10 + seededRandom(i * 17) * 10,
      };
    });
  }, [count]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" suppressHydrationWarning>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          animate={{
            y: [0, -200],
            x: Math.sin(particle.id) * 150,
            opacity: [0, 0.8, 0],
            scale: [0, 1, 0.5],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.width}px`,
            height: `${particle.height}px`,
            backgroundColor: particle.color,
            boxShadow: `0 0 ${particle.blurSize}px ${particle.color}`,
          }}
        />
      ))}
    </div>
  );
}

export function WaveAnimation() {
  return (
    <motion.svg
      className="w-full h-24 opacity-20 absolute bottom-0"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5, repeat: Infinity }}
    >
      <defs>
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-bioluminescent)" />
            <stop offset="50%" stopColor="var(--color-neon-coral)" />
            <stop offset="100%" stopColor="var(--color-goldenrod)" />
          </linearGradient>
      </defs>
      <path
        d="M0,50 Q300,0 600,50 T1200,50 L1200,120 L0,120 Z"
        fill="url(#wave-gradient)"
      />
      <path
        d="M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z"
        fill="url(#wave-gradient)"
        opacity="0.5"
      />
    </motion.svg>
  );
}

export function TypingIndicator() {
  return (
    <motion.div 
      className="flex space-x-2"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-gradient-to-r from-primary to-secondary rounded-full"
          animate={{ y: [0, -12, 0], scale: [1, 1.2, 1] }}
          transition={{
            duration: 0.8,
            delay: i * 0.15,
            repeat: Infinity,
          }}
        />
      ))}
    </motion.div>
  );
}

// Pulsing glow effect
export function PulseGlow() {
  return (
    <motion.div
      className="absolute w-96 h-96 bg-gradient-to-r from-primary to-secondary rounded-full blur-3xl"
      animate={{ 
        scale: [1, 1.2, 1],
        opacity: [0.1, 0.2, 0.1],
      }}
      transition={{ duration: 4, repeat: Infinity }}
      style={{ filter: 'blur(60px)' }}
    />
  );
}

// Floating symbols
export function FloatingEmojis({ emojis = ['+', '*', '#', '=', '~'] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const emojiData = useMemo(() => {
    return emojis.map((emoji, i) => ({
      emoji,
      id: i,
      duration: 6 + seededRandom(i * 23) * 4,
      delay: i * 0.5,
      left: seededRandom(i * 31) * 100,
      top: seededRandom(i * 29) * 100,
    }));
  }, [emojis]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" suppressHydrationWarning>
      {emojiData.map((data) => (
        <motion.div
          key={data.id}
          className="absolute text-xl font-semibold text-primary/25"
          animate={{
            y: [0, -100, 0],
            x: [0, 50, 0],
            rotate: [0, 360],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: data.duration,
            delay: data.delay,
            repeat: Infinity,
          }}
          style={{
            left: `${data.left}%`,
            top: `${data.top}%`,
          }}
        >
          {data.emoji}
        </motion.div>
      ))}
    </div>
  );
}
