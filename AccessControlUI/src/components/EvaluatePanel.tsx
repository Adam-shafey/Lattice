import { ReactNode } from 'react';
import { Card } from './ui/card';

export function EvaluatePanel({ children }: { children: ReactNode }) {
  return <Card className="p-4 space-y-2">{children}</Card>;
}
