import { expect, test, describe } from 'vitest';
import z from "zod";
import express from "express";
import type { AddressInfo } from "node:net";
import { 
  apiContract, 
  DIContainer, 
  endpoint, 
  HttpStatusCode, 
  middleware, 
  response, 
  route,
  createInProcApiClient,
  IDecoratorHandlerSchemas,
  IEndpointHandlerDecorator,
  DecoratorHandlerInput,
  DecoratorHandlerOutput,
  DecoratorHandlerContext,
  // decoratorFactory
} from '@congruent-stack/congruent-api';
import { createExpressRegistry } from '@congruent-stack/congruent-api-express';
import { createFetchClient } from '@congruent-stack/congruent-api-fetch';

describe('api_client', () => {
  interface ISessionUser {
    id: string;
    name: string;
    roles: string[];
  }

  interface ISessionUserProvider {
    get current(): ISessionUser;
  }

  interface ISessionUserService extends ISessionUserProvider {
    loginAsync(sessionToken: string): Promise<string | null>;
  }

  class SessionUserService implements ISessionUserService {
    private _user: ISessionUser | null = null;
    get current(): ISessionUser {
      if (!this._user) {
        throw new Error('No user is currently logged in');
      }
      return this._user;
    }

    async loginAsync(sessionToken: string): Promise<string | null> {
      if (sessionToken !== 'valid-token') {
        return 'Invalid session token';
      }
      this._user = { id: '123', name: 'Real John Doe', roles: [] };
      return null;
    }
  }

  const MissingRolesForbiddenResponseBodySchema = z.object({
    requiredRoles: z.array(z.string())
  });

  const contract = apiContract({
    api: {
      foo: {
        [':someParam']: {
          POST: endpoint({
            body: z.object({
              baz: z.string(),
              bar: z.number()
            }),
            responses: {
              [HttpStatusCode.OK_200]: response({ 
                body: z.object({
                  myparam: z.string(),
                  userName: z.string(),
                  bar: z.number(),
                  baz: z.string()
                })
              }),
            }
          })
        }
      },
      admin: {
        dashboard: {
          GET: endpoint({
            responses: {
              [HttpStatusCode.Forbidden_403]: response({
                body: MissingRolesForbiddenResponseBodySchema
              }),
              [HttpStatusCode.OK_200]: response({
                body: z.object({
                  message: z.string()
                })
              })
            }
          })
        }
      }
    }
  });

  const container = new DIContainer()
    .register('SessionUserSvc', () => new SessionUserService() as ISessionUserService, 'scoped')
    .register('SessionUserProvider', scope => scope.getSessionUserSvc() as ISessionUserProvider, 'scoped');
    
  const app = express();
  app.use(express.json());
  
  const apiReg = createExpressRegistry(app, container, contract);

  class TimeProfilerDecoratorSchemas implements IDecoratorHandlerSchemas {
    responses = {
      [HttpStatusCode.Forbidden_403]: response({
        body: z.object({
          foo: z.string()
        }),
      }),
    };
  }

  class TimeProfilerDecorator implements IEndpointHandlerDecorator<TimeProfilerDecoratorSchemas> {
    static create(diScope: ReturnType<typeof container.createScope>): TimeProfilerDecorator {
      return new TimeProfilerDecorator();
    }
    async handle(
      input: DecoratorHandlerInput<TimeProfilerDecoratorSchemas>, 
      context: DecoratorHandlerContext
    ): Promise<DecoratorHandlerOutput<TimeProfilerDecoratorSchemas>> {
      const start = performance.now();
      await context.next();
      const end = performance.now();
      // console.log(`Request for "${input.path}" took ${end - start} ms`);
      // return {
      //   code: HttpStatusCode.Forbidden_403,
      //   body: { 
      //     foo: 'bar' 
      //   }
      // }
    }
  }

  middleware(apiReg, '')
    .decorateWith(TimeProfilerDecorator)
    .inject(scope => ({
      sessionUserSvc: scope.getSessionUserSvc()
    }))
    .register({
      headers: z.object({ 'x-session-token': z.string() }),
      responses: {
        [HttpStatusCode.Unauthorized_401]: response({ body: z.object({ message: z.string() }) })
      }
    }, async (req, context) => {
      const sessionToken = req.headers['x-session-token'];
      const failureReason = await context.sessionUserSvc.loginAsync(sessionToken);
      if (failureReason) {
        return {
          code: HttpStatusCode.Unauthorized_401,
          body: { message: failureReason }
        }
      }
      await context.next();
    })

  route(apiReg, 'POST /api/foo/:someParam')
    .inject(scope => ({
      sessionUser: scope.getSessionUserProvider()
    }))
    .register(async (req, context) => {
      return { 
        code: HttpStatusCode.OK_200, 
        body: {
          myparam: req.pathParams.someParam,
          userName: context.sessionUser.current.name,
          bar: req.body.bar,
          baz: req.body.baz
        }
      };
    });

  class EnforceAdminDecoratorSchemas implements IDecoratorHandlerSchemas {
    responses = {
      [HttpStatusCode.Forbidden_403]: response({
        body: MissingRolesForbiddenResponseBodySchema
      }),
    };
  }

  class EnforceAdminDecorator implements IEndpointHandlerDecorator<EnforceAdminDecoratorSchemas> {
    static create(diScope: ReturnType<typeof container.createScope>): EnforceAdminDecorator {
      return new EnforceAdminDecorator(diScope.getSessionUserProvider());
    }

    private _sessionUser: ISessionUserProvider;
    constructor(sessionUser: ISessionUserProvider) {
      this._sessionUser = sessionUser;
    }
    
    async handle(req: DecoratorHandlerInput<EnforceAdminDecoratorSchemas>, context: DecoratorHandlerContext): Promise<DecoratorHandlerOutput<EnforceAdminDecoratorSchemas>> {
      if (!this._sessionUser.current.roles.includes('admin')) {
        return {
          code: HttpStatusCode.Forbidden_403,
          body: { requiredRoles: ['admin'] }
        };
      }
      await context.next();
    }
  }


  class BadCreateSignatureDecoratorSchemas implements IDecoratorHandlerSchemas {
    // query = z.object({
    //   unused: z.string()
    // });
    responses = {
      // commenting out will remove the compile error with ".decorate(BadCreateSignatureDecorator)"
      [HttpStatusCode.Forbidden_403]: response({
        body: MissingRolesForbiddenResponseBodySchema
      }),
    };
  }

  class BadCreateSignatureDecorator implements IEndpointHandlerDecorator<BadCreateSignatureDecoratorSchemas> {
    static create(x: string): BadCreateSignatureDecorator {
      return new BadCreateSignatureDecorator();
    }

    async handle(input: DecoratorHandlerInput<BadCreateSignatureDecoratorSchemas>, context: DecoratorHandlerContext): Promise<DecoratorHandlerOutput<BadCreateSignatureDecoratorSchemas>> {
      await context.next();
    }
  }

  class  BadSecondDecoratorSchemas implements IDecoratorHandlerSchemas {
    // query = z.object({
    //   unused: z.string()
    // });
    responses = {
      // commenting out will remove the compile error with ".decorate(BadCreateSignatureDecorator)"
      [HttpStatusCode.Forbidden_403]: response({
        body: MissingRolesForbiddenResponseBodySchema
      }),
    };
  }

  class BadSecondDecorator { // NOT implements IEndpointHandlerDecorator<BadSecondDecoratorSchemas> {
    static create(scope: ReturnType<typeof container.createScope>): BadSecondDecorator {
      return new BadSecondDecorator();
    }

    async handle(input: string, context: DecoratorHandlerContext): Promise<number> {
      await context.next();
      return 42;
    }
  }

  route(apiReg, 'GET /api/admin/dashboard')
    // ✅ SOLUTION: Automatic schema inference AND strict parameter type checking!
    .decorateWith(EnforceAdminDecorator)
    
    // ❌ Uncommenting these correctly causes compile errors:
    
    // Error: Types of parameters 'x' and 'diScope' are incompatible
    .decorate(BadCreateSignatureDecorator.create)
    .decorate(scope => new BadCreateSignatureDecorator()) 
    
    // Error: Types of parameters 'input' and 'input' are incompatible
    // (handle method has wrong signature: string instead of DecoratorHandlerInput)
    .decorate(BadSecondDecorator.create)
    .decorate(scope => new BadSecondDecorator()) 
    
    .inject(scope => ({
      sessionUser: scope.getSessionUserProvider()
    }))
    .register(async (_req) => {
      return {
        code: HttpStatusCode.OK_200,
        body: {
          message: 'Welcome to the admin dashboard'
        }
      };
    });

  test('Example of route handler unit testing using direct triggers', async () => {
    const testContainer = container.createTestClone()
      .override('SessionUserProvider', () => ({
        get current() { return { id: '456', name: 'Test John Doe', roles: [] }; }
      }));
    
    const response1 = await apiReg.api.foo[':someParam'].POST.trigger(
      testContainer.createScope(), 
      {
        headers: {}, 
        pathParams: { someParam: '10' }, 
        query: null,
        body: { baz: 'hello', bar: 123 }
      }
    );
    expect(response1.code).toBe(200);
    expect(response1.body).toEqual({
      myparam: '10',
      userName: 'Test John Doe',
      bar: 123,
      baz: 'hello'
    });

    const response2 = await route(apiReg, 'POST /api/foo/:someParam').trigger(
      testContainer.createScope(), 
      {
        headers: {}, 
        pathParams: { someParam: '20' }, 
        query: null,
        body: { baz: 'world', bar: 456 }
      }
    );
    expect(response2.code).toBe(200);
    expect(response2.body).toEqual({
      myparam: '20',
      userName: 'Test John Doe',
      bar: 456,
      baz: 'world'
    });
  });

  test('Example of route handler unit testing using inproc api client', async () => {
    const testContainer = container.createTestClone()
      .override('SessionUserProvider', () => ({
        get current() { return { id: '456', name: 'Test John Doe', roles: [] }; }
      }));

    const inProcClient1 = createInProcApiClient(contract, testContainer, apiReg, {
      filterMiddleware: (path, _) => false // skip all middleware
      // session user will not be set through middleware, but we override the provider anyway to return a test user
    });
    const response1 = await inProcClient1.api.foo.someParam('30').POST({
      body: { baz: 'foo', bar: 789 }
    });
    expect(response1.code).toBe(200);
    expect(response1.body).toEqual({
      myparam: '30',
      userName: 'Test John Doe',
      bar: 789,
      baz: 'foo'
    });

    const testContainerMiddlewareIncluded = container.createTestClone()
      .override('SessionUserSvc', () => ({
        get current(): ISessionUser {
          return { id: '999', name: 'Fake John Doe', roles: [] };
        },
        async loginAsync(_sessionToken: string) { return null; }
      }))
      .override('SessionUserProvider', (scope) => scope.getSessionUserSvc());

    const inProcClient2 = createInProcApiClient(contract, testContainerMiddlewareIncluded, apiReg, {
      enhanceRequest: (input) => {
        input.headers = {
          'x-session-token': 'valid-token',
          ...input.headers
        };
        return input;
      }
    });
    const response2 = await inProcClient2.api.foo.someParam('40').POST({
      body: { baz: 'bar', bar: 101112 }
    });
    expect(response2.code).toBe(200);
    expect(response2.body).toEqual({
      myparam: '40',
      userName: 'Fake John Doe',
      bar: 101112,
      baz: 'bar'
    });

    const inProcClient3 = createInProcApiClient(contract, testContainerMiddlewareIncluded, apiReg);
    const response3 = await inProcClient3.api.foo.someParam('40').POST({
      body: { baz: 'bar', bar: 101112 }
    });
    expect(response3.code).toBe(HttpStatusCode.BadRequest_400);
    // console.log('Response3 body:', response3.body);
  });

  test('Example of route handler end-to-end testing (middleware included)', async () => {
    // Listen on random port
    const server = app.listen(0);

    const port = typeof server.address() === "object"
      ? (server.address() as AddressInfo).port
      : undefined;

    const client1 = createFetchClient(contract, { 
      baseUrl: () => `http://localhost:${port}`,
      enhanceRequestInit: (reqInit) => {
        reqInit.headers = {
          'x-session-token': 'valid-token',
          ...reqInit.headers,
        };
        return reqInit;
      },
    });
    const response1 = await client1.api.foo.someParam('10').POST({
      body: { baz: 'bar', bar: 101112 }
    });
    expect(response1.code).toBe(200);
    expect(response1.body).toEqual({
      myparam: '10',
      userName: 'Real John Doe',
      bar: 101112,
      baz: 'bar'
    });

    const client2 = createFetchClient(contract, { 
      baseUrl: () => `http://localhost:${port}`,
      // No session token header
    });
    const response2 = await client2.api.foo.someParam('10').POST({
      body: { baz: 'bar', bar: 101112 }
    });
    expect(response2.code).toBe(HttpStatusCode.BadRequest_400);

    const client3 = createFetchClient(contract, { 
      baseUrl: () => `http://localhost:${port}`,
      enhanceRequestInit: (reqInit) => {
        reqInit.headers = {
          'x-session-token': 'bad-token',
          ...reqInit.headers,
        };
        return reqInit;
      },
    });
    const response3 = await client3.api.foo.someParam('10').POST({
      body: { baz: 'bar', bar: 101112 }
    });
    expect(response3.code).toBe(HttpStatusCode.Unauthorized_401);
    expect(response3.body).toEqual({ message: 'Invalid session token' });

    server.close();
  });

  test('Test admin decorator - should block non-admin users', async () => {
    const testContainer = container.createTestClone()
      .override('SessionUserProvider', () => ({
        get current() { return { id: '456', name: 'Test John Doe', roles: [] }; }
      }));

    const inProcClient = createInProcApiClient(contract, testContainer, apiReg, {
      filterMiddleware: (path, _) => false // skip all middleware for this test
    });
    
    const response = await inProcClient.api.admin.dashboard.GET();
    expect(response.code).toBe(HttpStatusCode.Forbidden_403);
    expect(response.body).toEqual({ requiredRoles: ['admin'] });
  });

  test('Test admin decorator - should allow admin users', async () => {
    const testContainer = container.createTestClone()
      .override('SessionUserProvider', () => ({
        get current() { return { id: '456', name: 'Test Admin User', roles: ['admin'] }; }
      }));

    const inProcClient = createInProcApiClient(contract, testContainer, apiReg, {
      filterMiddleware: (path, _) => false // skip all middleware for this test
    });
    
    const response = await inProcClient.api.admin.dashboard.GET();
    expect(response.code).toBe(HttpStatusCode.OK_200);
    expect(response.body).toEqual({ message: 'Welcome to the admin dashboard' });
  });
});