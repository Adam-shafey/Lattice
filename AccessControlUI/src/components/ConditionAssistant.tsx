import { Button } from './ui/button';

const snippets = {
  ownership: 'resource.owner == user.id',
  department: 'user.department == resource.department',
};

export function ConditionAssistant({ onInsert }: { onInsert: (text: string) => void }) {
  return (
    <div className="flex gap-2">
      {Object.entries(snippets).map(([key, snippet]) => (
        <Button key={key} size="sm" variant="outline" onClick={() => onInsert(snippet)}>
          {key}
        </Button>
      ))}
    </div>
  );
}
