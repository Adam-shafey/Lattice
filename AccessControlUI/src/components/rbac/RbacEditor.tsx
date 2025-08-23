import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import RolesTable from './RolesTable';
import PermissionsTable from './PermissionsTable';
import UsersTable from './UsersTable';
import Assignments from './Assignments';
import EffectivePermissions from './EffectivePermissions';
import { useState } from 'react';

export default function RbacEditor() {
  const [tab, setTab] = useState('roles');
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-2">
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="permissions">Permissions</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="assignments">Assignments</TabsTrigger>
        <TabsTrigger value="effective">Effective</TabsTrigger>
      </TabsList>
      <TabsContent value="roles"><RolesTable /></TabsContent>
      <TabsContent value="permissions"><PermissionsTable /></TabsContent>
      <TabsContent value="users"><UsersTable /></TabsContent>
      <TabsContent value="assignments"><Assignments /></TabsContent>
      <TabsContent value="effective"><EffectivePermissions /></TabsContent>
    </Tabs>
  );
}
