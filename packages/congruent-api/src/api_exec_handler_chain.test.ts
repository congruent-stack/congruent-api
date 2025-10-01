import { expect, test, describe } from 'vitest';
import z from 'zod';
import { apiContract } from './api_contract';
import { endpoint, HttpMethodEndpointResponses } from './http_method_endpoint';
import { HttpStatusCode } from './http_status_code';
import { HttpMethodEndpointResponse, response } from './http_method_endpoint_response';
import { middleware } from './api_middleware';
import { DIContainer } from './di_container';
import { createRegistry } from './api_handlers_registry';
import { route } from './api_routing';
import { execHandlerChain } from './api_exec_handler_chain';
import { ICanTriggerAsync } from './api_can_trigger';
import { DecoratorHandlerInput, DecoratorHandlerSchemas, IEndpointHandlerDecorator } from './endpoint_handler_decorator';

describe('api_exec_handler_chain', () => {

  test('execution order', async () => {
    const contract = apiContract({
      some: {
        path: {
          [':someparam']: {
            GET: endpoint({
              responses: {
                [HttpStatusCode.OK_200]: response({ body: z.string() }),
              },
            }),
          }
        },
        other: {
          path: {
            GET: endpoint({
              responses: {
                [HttpStatusCode.OK_200]: response({ body: z.string() }),
              },
            }),
          }
        }
      }
    });

    const container = new DIContainer()
      .register('Items', () => [] as string[], 'scoped');

    const mwHandlerEntries: ICanTriggerAsync[] = [];
    const apiReg = createRegistry(container, contract, {
      handlerRegisteredCallback: (_entry) => {},
      middlewareHandlerRegisteredCallback: (entry) => mwHandlerEntries.push(entry),
    });

    middleware(apiReg, '/some/path/:someparam')
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register({ responses: {} }, async (req, next) => {
        req.injected.items.push('mw-1');
        await next();
      });

    middleware(apiReg, '/some/path')
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register({ responses: {} }, async (req, next) => {
        req.injected.items.push('mw-2');
        await next();
      });

    middleware(apiReg, '/some')
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register({ responses: {} }, async (req, next) => {
        req.injected.items.push('mw-3');
        await next();
      });

    middleware(apiReg, '/some/path')
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register({ responses: {} }, async (req, next) => {
        req.injected.items.push('mw-4');
        await next();
      });

    class MyDecoratorSchemas implements DecoratorHandlerSchemas {
      responses = {};
    }

    class MyDecorator implements IEndpointHandlerDecorator<MyDecoratorSchemas> {
      static create(diScope: ReturnType<typeof container.createScope>): MyDecorator {
        return new MyDecorator(diScope.getItems());
      }

      private _items: string[];
      constructor(items: string[]) {
        this._items = items;
      }

      async handle(req: DecoratorHandlerInput<MyDecoratorSchemas>, next: () => Promise<void>): Promise<void> {
        this._items.push('dec-1');
        await next();
      }
    }

    route(apiReg, 'GET /some/path/:someparam')
      .decorate((scope) => new MyDecorator(scope.getItems()))
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register(async (req) => {
        req.injected.items.push('h-1');
        return { code: HttpStatusCode.OK_200, body: req.pathParams['someparam'] };
      });

    route(apiReg, 'GET /some/other/path')
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register(async (req) => {
        req.injected.items.push('h-2');
        return { code: HttpStatusCode.OK_200, body: 'some-other-path' };
      });

    const diScope1 = container.createScope();

    const genericPath1 = '/some/path/:someparam';
    const routeEntry1 = route(apiReg, `GET ${genericPath1}`);
    if (!routeEntry1.handler) {
      throw new Error('Route entry 1 has no handler');
    }
    const reqResponse1: any = await execHandlerChain(diScope1, [...mwHandlerEntries, routeEntry1], {
      method: 'GET',
      genericPath: '/some/path/:someparam',
      headers: {},
      pathParams: { 'someparam': 'some-value' },
      query: null,
      body: null,
      path: '/some/path/some-value',
      pathSegments: ['some', 'path', 'some-value'],
    });

    expect(reqResponse1).toBeDefined();
    expect(reqResponse1.code).toBe(HttpStatusCode.OK_200);
    expect(reqResponse1.body).toBe('some-value');

    const items1 = diScope1.getItems();
    expect(items1).toBeDefined();
    expect(items1.length).toBe(5);
    expect(items1).toEqual(['mw-1', 'mw-2', 'mw-3', 'mw-4', 'h-1']);


    const diScope2 = container.createScope();

    const genericPath2 = '/some/other/path';
    const routeEntry2 = route(apiReg, `GET ${genericPath2}`);
    if (!routeEntry2.handler) {
      throw new Error('Route entry 2 has no handler');
    }
    const reqResponse2: any = await execHandlerChain(diScope2, [...mwHandlerEntries, routeEntry2], {
      method: 'GET',
      genericPath: genericPath2,
      headers: {},
      pathParams: {},
      query: null,
      body: null,
      path: '/some/other/path',
      pathSegments: ['some', 'other', 'path'],
    });
    expect(reqResponse2).toBeDefined();
    expect(reqResponse2.code).toBe(HttpStatusCode.OK_200);
    expect(reqResponse2.body).toBe('some-other-path');

    const items2 = diScope2.getItems();
    expect(items2).toBeDefined();
    expect(items2.length).toBe(2);
    expect(items2).toEqual(['mw-3', 'h-2']);
  });

  test('thrown error in handler', async () => {
    const contract = apiContract({
      somepath: {
        POST: endpoint({
          body: z.object({
            name: z.string(),
          }),
          responses: {
            [HttpStatusCode.OK_200]: response({ body: z.string() }),
          }
        }),
      }
    });

    const container = new DIContainer();

    const mwHandlerEntries: ICanTriggerAsync[] = [];
    const apiReg = createRegistry(container, contract, {
      handlerRegisteredCallback: (_entry) => {},
      middlewareHandlerRegisteredCallback: (entry) => mwHandlerEntries.push(entry),
    });

    middleware(apiReg, '')
      .register({ 
        responses: {
          [HttpStatusCode.InternalServerError_500]: response({ body: z.string() }),
        } 
      }, async (_req, next) => {
        try {
          await next();
        } catch (err) {
          return { 
            code: HttpStatusCode.InternalServerError_500, 
            body: 'internal server error' 
          };
        }
      });

    route(apiReg, 'POST /somepath')
      .register(async (_req) => {
        throw new Error('some error');
      });

    const diScope = container.createScope();

    const routeEntry = route(apiReg, `POST /somepath`);
    if (!routeEntry.handler) {
      throw new Error('Route entry 1 has no handler');
    }
    const reqResponse: any = await execHandlerChain(diScope, [...mwHandlerEntries, routeEntry], {
      method: 'POST',
      genericPath: '/somepath',
      headers: {},
      pathParams: {},
      query: null,
      body: { name: 'some-name' },
      path: '/somepath',
      pathSegments: ['somepath'],
    });

    expect(reqResponse).toBeDefined();
    expect(reqResponse.code).toBe(HttpStatusCode.InternalServerError_500);
    expect(reqResponse.body).toBe('internal server error');
  });
});