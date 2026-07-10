import { HttpMethod } from './http_method_type.js';

/**
 * Builds the `handler.ts` contents for one endpoint method.
 * @param method       HTTP method, e.g. 'GET'
 * @param genericPath  Endpoint generic path, e.g. '/somepath/:myparam'
 */
export function renderHandler(method: HttpMethod, genericPath: string): string {
  return `route(apiReg, '${method} ${genericPath}')
  .inject(scope => ({

  }))
  .register(async (_req) => {
    throw Error('Not implemented')
  });
`;
}
