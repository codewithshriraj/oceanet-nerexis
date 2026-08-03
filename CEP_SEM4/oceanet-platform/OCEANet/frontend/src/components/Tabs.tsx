'use client';

import { ReactNode } from 'react';

export function Tabs({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function TabsList({ children }: { children: ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}

export function TabsTrigger({ children, value }: { children: ReactNode; value: string }) {
  return <div>{children}</div>;
}

export function TabsContent({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
