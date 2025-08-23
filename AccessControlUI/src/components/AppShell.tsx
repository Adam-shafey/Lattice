import { ReactNode } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-60 border-r p-4 space-y-2">
        <div className="text-xl font-bold">Lattice</div>
        <nav className="flex flex-col gap-2">
          <Button variant="ghost" className="justify-start">RBAC</Button>
          <Button variant="ghost" className="justify-start">ABAC</Button>
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b p-2 flex items-center gap-2">
          <Input placeholder="Search" className="w-72" />
        </header>
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
