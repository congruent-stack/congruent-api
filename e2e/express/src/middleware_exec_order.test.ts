import { describe, test, expect } from "vitest";
import z from "zod";
import express from "express";
import request from "supertest";
import { apiContract, DIContainer, endpoint, HttpStatusCode, middleware, response, route } from "@congruent-stack/congruent-api";
import { createExpressRegistry } from "@congruent-stack/congruent-api-express";
import { createFetchClient } from "@congruent-stack/congruent-api-fetch";
import type { AddressInfo } from "node:net";

describe("Express middleware execution order", () => {
  const RES_1_ITEMS = ['mw-1', 'mw-2', 'mw-3', 'mw-4', 'h-1'];
  const RES_2_ITEMS = ['mw-3', 'h-2'];

  test('test-1-bare-express', async () => {
    const app = express();
    app.use(express.json());

    app.use(async (_req, res, next) => {
      res.locals.items = [];
      await next();
    });

    app.use('/some/path/:someparam', async (_req, res, next) => {
      res.locals.items.push("mw-1");
      await next();
    });

    app.use('/some/path', async (_req, res, next) => {
      res.locals.items.push("mw-2");
      await next();
    });

    app.use('/some', async (_req, res, next) => {
      res.locals.items.push("mw-3");
      await next();
    });

    app.use('/some/path', async (_req, res, next) => {
      res.locals.items.push("mw-4");
      await next();
    });

    app.get('/some/path/:someparam', (req, res) => {
      res.locals.items.push("h-1");
      res.status(200).set('x-items', JSON.stringify(res.locals.items)).json(req.params['someparam']);
    });

    app.get('/some/other/path', (_req, res) => {
      res.locals.items.push("h-2");
      res.status(200).set('x-items', JSON.stringify(res.locals.items)).json('some-other-path');
    });

    const res1 = await request(app).get("/some/path/some-value");
    expect(res1.status).toBe(200);
    expect(res1.body).toBe("some-value");
    const items1 = JSON.parse(res1.headers['x-items'] as string);
    expect(items1).toEqual(RES_1_ITEMS);

    const res2 = await request(app).get("/some/other/path");
    expect(res2.status).toBe(200);
    expect(res2.body).toBe("some-other-path");
    const items2 = JSON.parse(res2.headers['x-items'] as string);
    expect(items2).toEqual(RES_2_ITEMS);
  });

  test('test-1-congruent-api-express', async () => {
    const responseHeadersSchema = z.object({
      'x-items': z.string(),
    });
    const contract = apiContract({
      some: {
        path: {
          [':someparam']: {
            GET: endpoint({
              responses: {
                [HttpStatusCode.OK_200]: response({ headers: responseHeadersSchema, body: z.string() }),
              },
            }),
          }
        },
        other: {
          path: {
            GET: endpoint({
              responses: {
                [HttpStatusCode.OK_200]: response({ headers: responseHeadersSchema, body: z.string() }),
              },
            }),
          }
        }
      }
    });

    const container = new DIContainer()
      .register('Items', () => [] as string[], 'scoped');

    const app = express();
    app.use(express.json());
    // Listen on random port
    const server = app.listen(0);
    const apiReg = createExpressRegistry(app, container, contract);

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

    route(apiReg, 'GET /some/path/:someparam')
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register(async (req) => {
        req.injected.items.push('h-1');
        return { code: HttpStatusCode.OK_200, headers: { 'x-items': JSON.stringify(req.injected.items) }, body: req.pathParams['someparam'] };
      });

    route(apiReg, 'GET /some/other/path')
      .inject((scope) => ({
        items: scope.getItems()
      }))
      .register(async (req) => {
        req.injected.items.push('h-2');
        return { code: HttpStatusCode.OK_200, headers: { 'x-items': JSON.stringify(req.injected.items) }, body: 'some-other-path' };
      });

    const res1 = await request(app).get("/some/path/some-value");
    expect(res1.status).toBe(200);
    expect(res1.body).toBe("some-value");
    const items1 = JSON.parse(res1.headers['x-items'] as string);
    expect(items1).toEqual(RES_1_ITEMS);

    const res2 = await request(app).get("/some/other/path");
    expect(res2.status).toBe(200);
    expect(res2.body).toBe("some-other-path");
    const items2 = JSON.parse(res2.headers['x-items'] as string);
    expect(items2).toEqual(RES_2_ITEMS);

    const port = typeof server.address() === "object"
      ? (server.address() as AddressInfo).port
      : undefined;

    const client = createFetchClient(contract, { baseUrl: () => `http://localhost:${port}` });
    const clientRes1 = await client.some.path.someparam('some-value').GET();
    expect(clientRes1.code).toBe(HttpStatusCode.OK_200);
    expect(clientRes1.body).toBe("some-value");
    const clientItems1 = JSON.parse(clientRes1.headers['x-items'] as string);
    expect(clientItems1).toEqual(RES_1_ITEMS);

    const clientRes2 = await client.some.other.path.GET();
    expect(clientRes2.code).toBe(HttpStatusCode.OK_200);
    expect(clientRes2.body).toBe("some-other-path");
    const clientItems2 = JSON.parse(clientRes2.headers['x-items'] as string);
    expect(clientItems2).toEqual(RES_2_ITEMS);

    const directResult = await route(apiReg, 'GET /some/other/path').trigger(
      container.createScope(), 
      {
        headers: {}, 
        pathParams: {}, 
        query: {}, 
        body: {}
      });
    expect(directResult.code).toBe(HttpStatusCode.OK_200);
  });
});

test("responds to /ping", async () => {
  const app = express();

  // Example middleware + route
  app.use(express.json());
  app.get("/ping", (_req, res) => {
    res.json({ ok: true });
  });

  const res = await request(app).get("/ping");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});
