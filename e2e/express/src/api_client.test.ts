import { expect, test, describe, afterAll } from 'vitest';
import type { AddressInfo } from "node:net";
import z from "zod";
import express from "express";

import { apiContract, DecoratorHandlerContext, DecoratorHandlerInput, DecoratorHandlerOutput, DIContainer, endpoint, HttpStatusCode, IDecoratorHandlerSchemas, IEndpointHandlerDecorator, middleware, RequestFailureCode, response, route } from '@congruent-stack/congruent-api';
import { createFetchClient } from '@congruent-stack/congruent-api-fetch';
import { createExpressRegistry, adapt } from '@congruent-stack/congruent-api-express';

describe('api_client', () => {
  const CommonHeadersSchema = z.object({
    "x-my-secret-header": z.string().optional(),
  });

  const ForbiddenResponseBodySchema = z.object({
    userMessage: z.string(),
  });

  const contract = apiContract({
    api: {
      foo: {
        POST: endpoint({
          responses: {
            [HttpStatusCode.OK_200]: response({
              body: z.string()
            }),
            [HttpStatusCode.NotFound_404]: response({
              body: z.object({ userMessage: z.string() })
            })
          }
        }),
        [':myparam']: {
          POST: endpoint({
            headers: CommonHeadersSchema,
            body: z.object({
              someField: z.string(),
            }),
            responses: {
              [HttpStatusCode.OK_200]: response({ 
                body: z.string() 
              }),
              [HttpStatusCode.NotFound_404]: response({
                body: z.object({ userMessage: z.string() })
              })
            }
          })
        }
      }
    }
  });

  class RoleCheckDecoratorSchemas implements IDecoratorHandlerSchemas {
    headers = CommonHeadersSchema;
    responses = {
      [HttpStatusCode.Forbidden_403]: response({
        body: ForbiddenResponseBodySchema,
      }),
    };
  }

  interface RoleCheckDecoratorParams {
    roles: string[];
  }

  class RoleCheckDecorator implements IEndpointHandlerDecorator<RoleCheckDecoratorSchemas> {
    private roles: string[];

    constructor(params: RoleCheckDecoratorParams) {
      this.roles = params.roles;
    }

    static create(_diScope: ReturnType<typeof container.createScope>, params: RoleCheckDecoratorParams): RoleCheckDecorator {
      return new RoleCheckDecorator(params);
    }
    
    async handle(input: DecoratorHandlerInput<RoleCheckDecoratorSchemas>, ctx: DecoratorHandlerContext): Promise<DecoratorHandlerOutput<RoleCheckDecoratorSchemas>> {
      const headerValue = input.headers["x-my-secret-header"] ?? "";
      const role = headerValue.split('-').pop();
      if (!role) {
        return {
          code: HttpStatusCode.Forbidden_403,
          body: {
            userMessage: "You must have a role to access this resource"
          }
        }
      }
      const hasRequiredRole = this.roles.includes(role);
      if (!hasRequiredRole) {
        return {
          code: HttpStatusCode.Forbidden_403,
          body: { 
            userMessage: "Insufficient role to access this resource"
          }
        }
      }
      await ctx.next();
    }
  }

  const app = express();
  app.use(express.json());

  const container = new DIContainer();
    
  // Listen on random port
  const server = app.listen(0);
  afterAll(() => server.close());
  
  // const apiReg = createExpressRegistry(app, container, contract);
  adapt({ expressApp: app, diContainer: container, apiContract: contract });
  const apiReg = contract.createRegistry<typeof container>();

  route(apiReg, 'POST /api/foo/:myparam')
    .decorateWith(RoleCheckDecorator, { roles: ['editor'] })
    .inject((scope) => ({
      foo: 'bar',
      // originalRequest: {}, // uncommenting this line causes a type error as expected, because 'originalRequest' is already defined in EndpointHandlerContext
    }))
    .register(async (req, _ctx) => {
      // console.log('Handler received param:', req.pathParams.myparam);
      return { 
        code: HttpStatusCode.OK_200, 
        body: req.pathParams.myparam
      };
    });

  // must be registered last, fallback for all unhandled routes
  middleware(apiReg, '') // empty string means it matches all possible routes
    .inject((scope) => ({
      foo: 'bar',
      // next: 'str', // uncommenting this line causes a type error as expected, because 'next' is already defined in MiddlewareHandlerContext
      // next: () => Promise.resolve(),
    }))
    .register({
      responses: {
        [HttpStatusCode.NotFound_404]: response({ body: z.object({ userMessage: z.string() }) })
      }
    }, async (req, ctx) => {
      // console.log('NOT FOUND middleware triggered for path:', req.path);
      return {
        code: HttpStatusCode.NotFound_404,
        body: {
          userMessage: 'Not found'
        }
      }
    });

  const port = typeof server.address() === "object"
    ? (server.address() as AddressInfo).port
    : undefined;

  const client = createFetchClient(contract, { 
    baseUrl: `http://localhost:${port}`,
    enhanceRequestInit: (init) => {
      return {
        ...init,
        headers: {
          ...init?.headers,
          'Content-Type': 'application/json',
          ...HEADERS
        },
      };
    }
  });

  const HEADERS = { 'x-my-secret-header': 'my-secret-editor' };

  // test with mockoon for 1000 requests -> body: "{{urlParam 'myparam'}}"
  // const client = createFetchClient(contract, { baseUrl: `http://localhost:3000` });

  test('Example of a single request using client object and failing due to schema validation error (1)', async () => {
    const response = await client.api.foo.myparam(123).POST({
      headers: HEADERS,
      body: {
        // @ts-ignore
        someField: 5//'some-value',
      }
    });
    if (response.code !== RequestFailureCode.SchemaValidationFailed) {
      expect.fail(`Expected ${RequestFailureCode.SchemaValidationFailed} SchemaValidationFailed but got ${response.code} with body ${JSON.stringify(response.body)}`);
    }
    expect(response.body).toHaveProperty('errors');
  });

  test('Example of a single request using client object and failing due to schema validation error (2)', async () => {
    // @ts-ignore
    const response = await client.api.foo.myparam(123).POST({
      headers: HEADERS
    });
    if (response.code !== RequestFailureCode.SchemaValidationFailed) {
      expect.fail(`Expected ${RequestFailureCode.SchemaValidationFailed} SchemaValidationFailed but got ${response.code} with body ${JSON.stringify(response.body)}`);
    }
    expect(response.body).toHaveProperty('errors');
  });

  test('Example of a single request using client object', async () => {
    const response = await client.api.foo.myparam(123).POST({
      headers: HEADERS,
      body: {
        someField: 'some-value',
      }
    });
    if (response.code !== HttpStatusCode.OK_200) {
      expect.fail(`Expected 200 OK but got ${response.code} with body ${JSON.stringify(response.body)}`);
    }
    expect(response.body).toBe(`123`);
  });

  test('Example of concurrent requests using client object', async () => {
    const arr = Array.from({ length: 150 }, (_, i) => i + 1);
    const promises = arr.map(i => 
      client.api.foo.myparam(i).POST({
        headers: HEADERS,
        body: {
          someField: 'some-value',
        }
      })
    );
    const responses = await Promise.allSettled(promises);
    // check that all requests were successful
    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (res.status === 'rejected') {
        console.error(`Request ${i + 1} failed:`, res.reason);
      }
      expect(res.status).toBe('fulfilled');
      if (res.status === 'fulfilled') {
        if (res.value.code !== HttpStatusCode.OK_200) {
          expect.fail(`Request ${i + 1} failed with code ${res.value.code} and body ${JSON.stringify(res.value.body)}`);
        }
        expect(res.value.code).toBe(HttpStatusCode.OK_200);
        expect(typeof res.value.body).toBe('string');
        expect(res.value.body).toBe(`${i + 1}`);
      }
    }
  });

  test('Example of wrong concurrent requests using client object', async () => {
    const count = 2;
    const arr = Array.from({ length: count }, (_, i) => i + 1);
    // the mistake is here, NEVER capture a parameterized context
    const myParamCtxArr = arr.map(i => client.api.foo.myparam(i));
    // @ts-ignore
    expect(client.__CONTEXT__.pathParameters.myparam).toBe(`${count}`); // last value set
    const promises = myParamCtxArr.map(p => {
      // all calls except for last one will loose the __CONTEXT__, 
      // and path param 'myparam' will be replaced with ?
      // => path will become /api/foo/?
      return p.POST({
        headers: HEADERS,
        body: { someField: 'some-value' }
      }) 
    });
    const responses = await Promise.allSettled(promises);
    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (res.status === 'fulfilled') {
        res.value.code
        if (res.value.code === HttpStatusCode.OK_200) {
          expect(typeof res.value.body).toBe('string');
          expect(res.value.body).toBe(`${count}`);
        } else if (res.value.code === HttpStatusCode.NotFound_404) {
          expect(res.value.body).toEqual({ userMessage: 'Not found' });
        } else {
          res.value.body
        }
      } else {
        expect.fail(res.reason, `Request ${i + 1} was rejected`);
      }
    }
  });
});