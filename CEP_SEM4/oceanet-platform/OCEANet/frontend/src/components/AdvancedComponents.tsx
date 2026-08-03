'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface BioHealthIndexProps {
  score?: number;
}

type InsightItem = {
  label: string;
  value: string;
};

type ReasoningItem = {
  factor: string;
  change: string;
  impact: 'Critical' | 'High' | 'Medium';
};

export function BiodiversityHealthIndex({ score = 73 }: BioHealthIndexProps) {
  const metrics = [
    { label: 'Species Richness', value: 82 },
    { label: 'Pollution Level', value: 45 },
    { label: 'Climate Stress', value: 62 },
    { label: 'Oxygen Stability', value: 78 },
    { label: 'Population Stability', value: 68 },
  ];

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="glass rounded-lg p-8">
      <h3 className="text-2xl font-bold text-text-primary mb-6">Biodiversity Health Index</h3>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Circular Progress */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="45"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
                fill="none"
              />
              <motion.circle
                cx="60"
                cy="60"
                r="45"
                stroke="url(#gradient)"
                strokeWidth="4"
                fill="none"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-bioluminescent)" />
                    <stop offset="100%" stopColor="var(--color-seafoam)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-bioluminescent">{score}</div>
                <div className="text-sm text-text-secondary">Overall Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Breakdown */}
        <div className="flex-1 space-y-4">
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-text-secondary font-medium">{metric.label}</span>
                <span className="text-bioluminescent font-semibold">{metric.value}%</span>
              </div>
              <div className="w-full bg-white bg-opacity-10 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.value}%` }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                  className="h-full bg-gradient-to-r from-bioluminescent to-seafoam"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 rounded-lg border" style={{ background: 'rgba(31, 41, 55, 0.07)', borderColor: 'rgba(31, 41, 55, 0.2)' }}>
        <p className="text-sm text-bioluminescent font-semibold mb-2">Status</p>
        <p className="text-text-secondary text-sm">
          The ecosystem shows healthy biodiversity with moderate climate stress. Continued monitoring recommended for oxygen stability in deep waters.
        </p>
      </div>
    </div>
  );
}

export function ExplainableAIPanel({
  insights = [
    { label: 'Prediction Confidence', value: '92%' },
    { label: 'Models Used', value: '12' },
    { label: 'Data Points Analyzed', value: '847K' },
  ],
  reasoning = [
    { factor: 'Sea Surface Temperature', change: '+2.1°C', impact: 'High' },
    { factor: 'Dissolved Oxygen', change: '-14%', impact: 'Critical' },
    { factor: 'Fishing Pressure', change: '+8%', impact: 'Medium' },
    { factor: 'Plankton Abundance', change: '-18%', impact: 'High' },
  ],
  prediction =
    'High temperature + low oxygen + reduced plankton detected. Coral bleaching risk elevated by 23% in the next 60 days. Recommend immediate conservation measures.',
}: {
  insights?: InsightItem[];
  reasoning?: ReasoningItem[];
  prediction?: string;
}) {

  return (
    <div className="glass rounded-lg p-8">
      <h3 className="text-2xl font-bold text-text-primary mb-6">Explainable AI Analysis</h3>

      {/* AI Insights */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-bioluminescent mb-4">Model Confidence</h4>
        <div className="grid grid-cols-3 gap-4">
          {insights.map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white bg-opacity-5 rounded-lg p-4 text-center"
            >
              <p className="text-2xl font-bold text-bioluminescent">{insight.value}</p>
              <p className="text-sm text-text-secondary mt-2">{insight.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reasoning Factors */}
      <div>
        <h4 className="text-lg font-semibold text-seafoam mb-4">Key Contributing Factors</h4>
        <div className="space-y-3">
          {reasoning.map((item, i) => (
              <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center justify-between p-3 bg-white bg-opacity-5 rounded-lg border border-white border-opacity-10"
            >
              <span className="text-text-primary font-medium">{item.factor}</span>
              <div className="flex items-center gap-4">
                <span className="text-neon-coral font-semibold">{item.change}</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    item.impact === 'Critical'
                      ? 'bg-ocean-red bg-opacity-20 text-ocean-red'
                      : item.impact === 'High'
                      ? 'bg-ocean-orange bg-opacity-20 text-ocean-orange'
                      : 'bg-ocean-yellow bg-opacity-20 text-ocean-yellow'
                  }`}
                >
                  {item.impact}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Prediction Box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 p-4 rounded-lg border"
        style={{ background: 'rgba(31, 41, 55, 0.07)', borderColor: 'rgba(31, 41, 55, 0.2)' }}
      >
        <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>AI Prediction</p>
        <p className="text-text-secondary">{prediction}</p>
      </motion.div>
    </div>
  );
}

export function SmartAIInsightBox({
  insight = 'High temperature (+2.1°C) + low oxygen (-14%) + reduced plankton (-18%) detected. Coral bleaching risk elevated by 23%.',
  confidence = '92%',
  status = 'Critical Alert',
}: {
  insight?: string;
  confidence?: string;
  status?: string;
}) {
  return (
      <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-lg p-6 border-l-4 border-bioluminescent"
    >
      <h4 className="text-lg font-bold text-bioluminescent mb-3 flex items-center space-x-2">
        <span>AI Insight</span>
      </h4>
      <p className="text-text-secondary leading-relaxed">{insight}</p>
      <div className="mt-4 flex gap-2 flex-wrap">
        <span className="px-3 py-1 bg-ocean-red bg-opacity-20 text-ocean-red text-sm rounded-full">
          {status}
        </span>
        <span className="px-3 py-1 bg-bioluminescent bg-opacity-20 text-bioluminescent text-sm rounded-full">
          Confidence: {confidence}
        </span>
      </div>
    </motion.div>
  );
}
