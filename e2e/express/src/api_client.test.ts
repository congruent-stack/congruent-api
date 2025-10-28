import { expect, test, describe, afterAll } from 'vitest';
import type { AddressInfo } from "node:net";
import z from "zod";
import express from "express";

import { apiContract, DIContainer, endpoint, HttpStatusCode, middleware, response, route } from '@congruent-stack/congruent-api';
import { createFetchClient } from '@congruent-stack/congruent-api-fetch';
import { createExpressRegistry } from '@congruent-stack/congruent-api-express';

describe('api_client', () => {
  const contract = apiContract({
    api: {
      foo: {
        POST: endpoint({
          responses: {
            [HttpStatusCode.OK_200]: response({
              body: z.string()
            })
          }
        }),
        [':myparam']: {
          POST: endpoint({
            responses: {
              [HttpStatusCode.OK_200]: response({ 
                body: z.string() 
              }),
            }
          })
        }
      }
    }
  });

  const app = express();
  app.use(express.json());

  const container = new DIContainer();
    
  // Listen on random port
  const server = app.listen(0);
  afterAll(() => server.close());
  
  const apiReg = createExpressRegistry(app, container, contract);

  route(apiReg, 'POST /api/foo/:myparam')
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

  const client = createFetchClient(contract, { baseUrl: `http://localhost:${port}` });

  // test with mockoon for 1000 requests -> body: "{{urlParam 'myparam'}}"
  // const client = createFetchClient(contract, { baseUrl: `http://localhost:3000` });

  test('Example of concurrent requests using client object', async () => {
    const arr = Array.from({ length: 150 }, (_, i) => i + 1);
    const promises = arr.map(i => client.api.foo.myparam(i).POST());
    const responses = await Promise.allSettled(promises);
    // check that all requests were successful
    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (res.status === 'rejected') {
        console.error(`Request ${i + 1} failed:`, res.reason);
      }
      expect(res.status).toBe('fulfilled');
      if (res.status === 'fulfilled') {
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
      return p.POST() 
    });
    const responses = await Promise.allSettled(promises);
    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (res.status === 'fulfilled') {
        if (res.value.code === HttpStatusCode.OK_200) {
          expect(typeof res.value.body).toBe('string');
          expect(res.value.body).toBe(`${count}`);
        } else if (res.value.code === HttpStatusCode.NotFound_404) {
          expect(res.value.body).toEqual({ userMessage: 'Not found' });
        }
      } else {
        expect.fail(res.reason, `Request ${i + 1} was rejected`);
      }
    }
  });
});