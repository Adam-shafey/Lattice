import { useEffect, useState } from 'react';
import { DataTable, Column } from '../DataTable';
import { Button } from '../ui/button';

interface Role {
  id: string;
  name: string;
  contextType: string;
  permissions: string[];
}

export default function RolesTable() {
  const [roles, setRoles] = useState<Role[]>([]);
  useEffect(() => {
    fetch('/api/roles').then((r) => r.json()).then(setRoles);
  }, []);

  const columns: Column<Role>[] = [
    { header: 'Name', accessor: (r) => r.name },
    { header: 'Context', accessor: (r) => r.contextType },
    { header: '# Permissions', accessor: (r) => r.permissions.length },
    { header: 'Actions', accessor: (r) => <Button size="sm">Edit</Button> },
  ];

  return <DataTable columns={columns} data={roles} />;
}
