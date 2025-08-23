import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import RbacEditor from './components/rbac/RbacEditor';
import AbacEditor from './components/abac/AbacEditor';
import { AppShell } from './components/AppShell';

export default function App() {
  const [tab, setTab] = useState('rbac');
  return (
    <AppShell>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="rbac">RBAC Policy Editor</TabsTrigger>
          <TabsTrigger value="abac">ABAC Policy Editor</TabsTrigger>
        </TabsList>
        <TabsContent value="rbac"><RbacEditor /></TabsContent>
        <TabsContent value="abac"><AbacEditor /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
