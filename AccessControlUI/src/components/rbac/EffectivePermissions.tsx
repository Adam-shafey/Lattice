import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface EffectivePermission {
  key: string;
  source: string;
}

export default function EffectivePermissions() {
  const [perms, setPerms] = useState<EffectivePermission[]>([]);
  const [userId, setUserId] = useState('');

  const load = () => {
    fetch(`/api/users/${userId}/effective-permissions`).then((r) => r.json()).then(setPerms);
  };

  return (
    <div className="space-y-2">
      <input className="border p-1" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
      <Button onClick={load}>Load</Button>
      <div className="flex flex-wrap gap-2">
        {perms.map((p) => (
          <Badge key={p.key} variant={p.source === 'deny' ? 'destructive' : 'default'}>
            {p.key} ({p.source})
          </Badge>
        ))}
      </div>
    </div>
  );
}
