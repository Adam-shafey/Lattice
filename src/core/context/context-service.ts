export interface ResolveContextInput {
  routeParam?: string | null;
  header?: string | null;
  query?: string | null;
}

export interface ContextObject { id: string }

export class ContextService {
  resolveContext(input: ResolveContextInput): ContextObject | null {
    const candidates = [input.routeParam, input.header, input.query].filter(Boolean) as string[];
    if (candidates.length === 0) return null;
    const selected = input.routeParam ?? input.header ?? input.query;
    return selected ? { id: selected } : null;
  }
}


