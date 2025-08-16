export interface User { id: string; email: string; }
export interface Role { id: string; name: string; contextType: string; }
export interface Context { id: string; type: string; name?: string; }
