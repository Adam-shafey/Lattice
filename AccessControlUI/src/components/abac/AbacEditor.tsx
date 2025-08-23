import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import PoliciesTable from './PoliciesTable';
import EvaluateAccess from './EvaluateAccess';

export default function AbacEditor() {
  const [tab, setTab] = useState('policies');
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-2">
        <TabsTrigger value="policies">Policies</TabsTrigger>
        <TabsTrigger value="evaluate">Evaluate</TabsTrigger>
      </TabsList>
      <TabsContent value="policies"><PoliciesTable /></TabsContent>
      <TabsContent value="evaluate"><EvaluateAccess /></TabsContent>
    </Tabs>
  );
}
