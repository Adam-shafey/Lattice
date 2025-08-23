import { useEffect, useState } from 'react';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';

interface Context {
  id: string;
  type: string;
  name: string;
}

export function ContextSelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [contexts, setContexts] = useState<Context[]>([]);
  useEffect(() => {
    fetch('/api/contexts').then((r) => r.json()).then(setContexts);
  }, []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>{value || 'Context'}</SelectTrigger>
      <SelectContent>
        {contexts.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
