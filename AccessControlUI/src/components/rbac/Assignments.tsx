import { useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../ui/select';

export default function Assignments() {
  const [userId, setUserId] = useState('');
  return (
    <div className="space-y-2">
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger>{userId || 'Select User'}</SelectTrigger>
        <SelectContent>
          <SelectItem value="1">User 1</SelectItem>
        </SelectContent>
      </Select>
      <Button>Assign</Button>
    </div>
  );
}
