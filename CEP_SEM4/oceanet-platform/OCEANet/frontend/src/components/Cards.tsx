'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  delay?: number;
  hover?: boolean;
}

export function AnimatedCard({ children, delay = 0, hover = true }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.24, ease: 'easeOut' }}
      whileHover={hover ? { y: -2, scale: 1.005 } : {}}
      whileTap={{ scale: 0.995 }}
      className="card hover:shadow-glow transition-all duration-200"
    >
      {children}
    </motion.div>
  );
}

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div 
      whileHover={{ y: -0.5 }}
      className={`glass rounded-xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function StatCard({ icon: Icon, label, value, trend }: any) {
  return (
    <motion.div 
      className="card-hover"
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-text-secondary text-sm font-medium">{label}</p>
          <motion.p 
            className="text-3xl font-bold mt-2 text-text-primary"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {value}
          </motion.p>
          {trend && (
            <motion.p 
              className={`text-sm mt-2 font-bold ${trend > 0 ? 'text-success' : 'text-error'}`}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              {trend > 0 ? 'Up' : 'Down'} {Math.abs(trend)}%
            </motion.p>
          )}
        </div>
        <motion.div 
          className="p-3 rounded-lg border border-slate-300 bg-slate-100"
          whileHover={{ scale: 1.01 }}
        >
          <Icon size={22} className="text-text-primary" />
        </motion.div>
      </div>
    </motion.div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton h-12 rounded-lg" />
      ))}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: string }) {
  const variants = {
    default: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
  };
  return <span className={`badge ${variants[variant as keyof typeof variants]}`}>{children}</span>;
}
