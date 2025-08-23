import { useEffect, useState } from 'react';
import { DataTable, Column } from '../DataTable';
import { Button } from '../ui/button';

interface Policy {
  id: string;
  action: string;
  resource: string;
  effect: string;
  condition: string;
}

export default function PoliciesTable() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  useEffect(() => {
    fetch('/api/policies').then((r) => r.json()).then(setPolicies);
  }, []);

  const columns: Column<Policy>[] = [
    { header: 'Action', accessor: (p) => p.action },
    { header: 'Resource', accessor: (p) => p.resource },
    { header: 'Effect', accessor: (p) => p.effect },
    { header: 'Condition', accessor: (p) => p.condition },
    { header: 'Actions', accessor: () => <Button size="sm">Edit</Button> },
  ];

  return <DataTable columns={columns} data={policies} />;
}
