import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface Props {
  userId: string;
  actingUser: string;
}

export function PermissionEditor({ userId, actingUser }: Props) {
  const [perms, setPerms] = useState<string[]>([]);
  const [newPerm, setNewPerm] = useState('');

  async function load() {
    const res = await apiFetch(`/permissions/user/${userId}`, actingUser);
    const data = await res.json();
    const keys = Array.isArray(data)
      ? data.map((p: any) => p.permissionKey || p.key || p)
      : [];
    setPerms(keys);
  }

  useEffect(() => {
    load();
  }, [userId, actingUser]);

  const grant = async () => {
    if (!newPerm) return;
    await apiFetch('/permissions/user/grant', actingUser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, permissionKey: newPerm })
    });
    setNewPerm('');
    load();
  };

  const revoke = async (perm: string) => {
    await apiFetch('/permissions/user/revoke', actingUser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, permissionKey: perm })
    });
    load();
  };

  return (
    <div>
      <h4>Permissions</h4>
      <ul>
        {perms.map(p => (
          <li key={p}>
            {p} <button onClick={() => revoke(p)}>Revoke</button>
          </li>
        ))}
      </ul>
      <input
        value={newPerm}
        onChange={e => setNewPerm(e.target.value)}
        placeholder="permission key"
      />
      <button onClick={grant}>Grant</button>
    </div>
  );
}
