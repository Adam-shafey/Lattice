import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EvaluatePanel } from '../EvaluatePanel';

export default function EvaluateAccess() {
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState({ user: '', action: '', resource: '' });

  const evaluate = async () => {
    const rbac = await fetch(`/api/users/${form.user}/effective-permissions`).then((r) => r.json());
    const abac = await fetch('/api/policies/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: form.user, action: form.action, resource: form.resource, attrs: {} }),
    }).then((r) => r.json());
    const allowed = rbac.includes(form.action) && abac === true;
    setResult(allowed ? 'ALLOW' : 'DENY');
  };

  return (
    <EvaluatePanel>
      <Input placeholder="User" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
      <Input placeholder="Action" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
      <Input placeholder="Resource" value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} />
      <Button onClick={evaluate}>Evaluate</Button>
      {result && <div className="font-bold">{result}</div>}
    </EvaluatePanel>
  );
}
