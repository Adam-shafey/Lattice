"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextService = void 0;
class ContextService {
    resolveContext(input) {
        const candidates = [input.routeParam, input.header, input.query].filter(Boolean);
        if (candidates.length === 0)
            return null;
        const selected = input.routeParam ?? input.header ?? input.query;
        return selected ? { id: selected } : null;
    }
}
exports.ContextService = ContextService;
