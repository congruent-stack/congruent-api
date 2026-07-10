import { HttpMethod } from './http_method_type.js';

const HTTP_METHOD_KEYS: ReadonlySet<string> = new Set<HttpMethod>([
  'ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD',
]);

export interface EndpointPathEntry {
  /** Raw contract path segments, e.g. ['somepath', ':myparam'] */
  readonly segments: readonly string[];
  /** HTTP methods defined at this path, e.g. ['GET', 'POST'] */
  readonly methods: readonly HttpMethod[];
}

/**
 * Walks an API contract definition and collects every path that holds
 * at least one HTTP method endpoint. Keys that are HTTP method names
 * mark an endpoint; every other object-valued key is a path segment.
 */
export function collectEndpointPaths(definition: Record<string, unknown>): EndpointPathEntry[] {
  const byPath = new Map<string, { segments: string[]; methods: HttpMethod[] }>();
  walk(definition, [], byPath);
  return [...byPath.values()];
}

function walk(
  node: Record<string, unknown>,
  segments: string[],
  byPath: Map<string, { segments: string[]; methods: HttpMethod[] }>,
): void {
  for (const [key, value] of Object.entries(node)) {
    if (value === null || typeof value !== 'object') {
      continue;
    }
    if (HTTP_METHOD_KEYS.has(key)) {
      const pathKey = segments.join('/');
      let entry = byPath.get(pathKey);
      if (!entry) {
        entry = { segments: [...segments], methods: [] };
        byPath.set(pathKey, entry);
      }
      entry.methods.push(key as HttpMethod);
    } else {
      walk(value as Record<string, unknown>, [...segments, key], byPath);
    }
  }
}
