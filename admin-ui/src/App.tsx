import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { User, Role } from './types';
import { PermissionEditor } from './components/PermissionEditor';
import { RoleAssigner } from './components/RoleAssigner';
import { ContextManager } from './components/ContextManager';

export default function App() {
  const [actingUser, setActingUser] = useState('user_admin');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    load();
  }, [actingUser]);

  async function load() {
    const uRes = await apiFetch('/users', actingUser);
    const uData = await uRes.json();
    setUsers(Array.isArray(uData) ? uData : []);

    const rRes = await apiFetch('/roles?contextType=team', actingUser);
    const rData = await rRes.json();
    setRoles(Array.isArray(rData) ? rData : rData.roles || []);
  }

  return (
    <div>
      <h1>Lattice Admin UI</h1>
      <label>
        Acting user:
        <select value={actingUser} onChange={e => setActingUser(e.target.value)}>
          <option value="user_admin">Admin</option>
          <option value="user_manager">Manager</option>
          <option value="user_viewer">Viewer</option>
        </select>
      </label>

      <section>
        <h2>Users</h2>
        {users.map(u => (
          <div key={u.id} style={{ border: '1px solid #ccc', marginBottom: '1rem', padding: '0.5rem' }}>
            <strong>{u.email}</strong> <em>({u.id})</em>
            <RoleAssigner userId={u.id} actingUser={actingUser} />
            <PermissionEditor userId={u.id} actingUser={actingUser} />
          </div>
        ))}
      </section>

      <section>
        <h2>Roles</h2>
        <ul>
          {roles.map(r => (
            <li key={r.id}>{r.name} ({r.contextType})</li>
          ))}
        </ul>
      </section>

      <ContextManager actingUser={actingUser} />
    </div>
  );
}
