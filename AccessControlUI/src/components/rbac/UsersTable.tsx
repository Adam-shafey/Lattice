import { useEffect, useState } from 'react';
import { DataTable, Column } from '../DataTable';
import { Button } from '../ui/button';

interface User {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export default function UsersTable() {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then(setUsers);
  }, []);

  const columns: Column<User>[] = [
    { header: 'Email', accessor: (u) => u.email },
    { header: 'Roles', accessor: (u) => u.roles.join(', ') },
    { header: 'Permissions', accessor: (u) => u.permissions.join(', ') },
    { header: 'Actions', accessor: () => <Button size="sm">Manage</Button> },
  ];

  return <DataTable columns={columns} data={users} />;
}
