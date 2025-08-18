export interface ResolveContextInput {
    routeParam?: string | null;
    header?: string | null;
    query?: string | null;
}
export interface ContextObject {
    id: string;
}
export declare class ContextService {
    resolveContext(input: ResolveContextInput): ContextObject | null;
}
