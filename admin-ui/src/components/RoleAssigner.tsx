import { useState } from 'react';
import { apiFetch } from '../api';

interface Props {
  userId: string;
  actingUser: string;
}

export function RoleAssigner({ userId, actingUser }: Props) {
  const [roleName, setRoleName] = useState('');
  const [contextType, setContextType] = useState('team');

  const assign = async () => {
    if (!roleName) return;
    await apiFetch('/roles/assign', actingUser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleName, userId, contextType })
    });
    setRoleName('');
  };

  const remove = async () => {
    if (!roleName) return;
    await apiFetch('/roles/remove', actingUser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleName, userId, contextType })
    });
    setRoleName('');
  };

  return (
    <div>
      <h4>Roles</h4>
      <input
        value={roleName}
        onChange={e => setRoleName(e.target.value)}
        placeholder="role name"
      />
      <input
        value={contextType}
        onChange={e => setContextType(e.target.value)}
        placeholder="context type"
      />
      <button onClick={assign}>Assign</button>
      <button onClick={remove}>Remove</button>
    </div>
  );
}
