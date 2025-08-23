import { useEffect, useState } from 'react';
import { DataTable, Column } from '../DataTable';
import { Button } from '../ui/button';

interface Permission {
  id: string;
  key: string;
  description: string;
  contextScope: string;
}

export default function PermissionsTable() {
  const [perms, setPerms] = useState<Permission[]>([]);
  useEffect(() => {
    fetch('/api/permissions').then((r) => r.json()).then(setPerms);
  }, []);

  const columns: Column<Permission>[] = [
    { header: 'Key', accessor: (p) => p.key },
    { header: 'Description', accessor: (p) => p.description },
    { header: 'Scope', accessor: (p) => p.contextScope },
    { header: 'Actions', accessor: () => <Button size="sm">Edit</Button> },
  ];

  return <DataTable columns={columns} data={perms} />;
}
