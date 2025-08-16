import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface Props {
  actingUser: string;
}

export function ContextManager({ actingUser }: Props) {
  const [contexts, setContexts] = useState<any[]>([]);
  const [id, setId] = useState('');
  const [type, setType] = useState('');
  const [name, setName] = useState('');

  async function load() {
    const res = await apiFetch('/contexts', actingUser);
    const data = await res.json();
    const list = Array.isArray(data.contexts) ? data.contexts : data;
    setContexts(list);
  }

  useEffect(() => {
    load();
  }, [actingUser]);

  const create = async () => {
    if (!id || !type) return;
    await apiFetch('/contexts', actingUser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type, name: name || undefined })
    });
    setId('');
    setType('');
    setName('');
    load();
  };

  return (
    <section>
      <h2>Contexts</h2>
      <ul>
        {contexts.map(c => (
          <li key={c.id}>{c.id} ({c.type})</li>
        ))}
      </ul>
      <input value={id} onChange={e => setId(e.target.value)} placeholder="id" />
      <input value={type} onChange={e => setType(e.target.value)} placeholder="type" />
      <input value={name} onChange={e => setName(e.target.value)} placeholder="name" />
      <button onClick={create}>Create</button>
    </section>
  );
}
