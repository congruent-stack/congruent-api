import { expect, test, describe } from 'vitest';
import z from "zod";

import { createInProcApiClient, HttpStatusCode, createRegistry, apiContract, endpoint, response, route, middleware } from "./index.js";
import { DIContainer } from './di_container.js';


describe('api_client_inproc', () => {
  
  const BaseRequestHeadersSchema = z.object({
    'x-tenant-id': z.string(),
  });

  const BaseRequestBodySchema = z.object({
    tenantId: z.string(),
  });

  const PokemonSchema = BaseRequestBodySchema.extend({
    id: z.number().int().min(1),
    name: z.string(),
    type: z.union([
      z.literal('fire'),
      z.literal('water'),
      z.literal('grass'),
    ]),
    description: z.string().optional(),
  });

  type Pokemon = z.output<typeof PokemonSchema>;

  const CreatePokemonSchema = PokemonSchema.omit({ id: true });

  // type CreatePokemon = z.output<typeof CreatePokemonSchema>;

  const NotFoundSchema = z.object({
    userMessage: z.string(),
  });

  const pokedexApiContract = apiContract({
    pokemons: {
      POST: endpoint({
        headers: BaseRequestHeadersSchema,
        body: CreatePokemonSchema,
        responses: {
          [HttpStatusCode.Created_201]: response({ body: z.number().int() }),
        }
      }),
      [':id']: {
        GET: endpoint({
          headers: BaseRequestHeadersSchema,
          responses: {
            [HttpStatusCode.OK_200]: response({ body: PokemonSchema }),
            [HttpStatusCode.NotFound_404]: response({ body: NotFoundSchema }),
          },
        }),
      }
    }
  });

  class LoggerService {
    public log(message: string): void {
      console.log(`[LOG]: ${message}`);
    }
  }

  class PokemonService {

    constructor(
      private readonly logger: LoggerService
    ) {}

    getPokemon(id: number): Pokemon | null {
      this.logger.log(`Fetching Pokemon with ID: ${id}`);
      return {
        tenantId: 'XXX',
        id,
        name: "Bulbasaur",
        type: "grass",
        description: "A grass-type Pokémon."
      };
    }
  }

  const dicontainer = new DIContainer()
    .register('LoggerSvc', () => new LoggerService(), 'singleton') // here, the registration order matters, it forces the end developer to push common deps up in the chain
    .register('PokemonSvc', (scope) => new PokemonService(scope.getLoggerSvc()), 'transient');

  const pokedexApiReg = createRegistry(dicontainer, pokedexApiContract, {
    handlerRegisteredCallback: (entry) => {
      //console.log('Registering route:', entry.methodEndpoint.genericPath);
    },
    middlewareHandlerRegisteredCallback: (entry) => {
      //console.log('Registering middleware:', entry.genericPath);
    },
  });

  middleware(pokedexApiReg, '/pokemons') // /:id
    .inject((c) => ({
      loggerSvc: c.getLoggerSvc()
    }))
    .register({
      headers: BaseRequestHeadersSchema,
      body: BaseRequestBodySchema.optional(),
        // .optional(), -> field not provided, or explicitly `undefined`
        // .nullable(), -> field explicitly `null`
        // .nullish(),  -> field not provided, explicitly `null`, or explicitly `undefined`
      responses: {}
    }, async (req, next) => {
      req.injected.loggerSvc.log(`tenant id from header = ${req.headers['x-tenant-id']}`);
      if (req.body) {
        req.injected.loggerSvc.log(`tenant id from body = ${req.body.tenantId}`);
      } else {
        req.injected.loggerSvc.log('No body provided');
      }
      req.injected.loggerSvc.log('Middleware triggered for Pokemons API');
      await next();
    });

  route(pokedexApiReg, 'GET /pokemons/:id')
    .inject((scope) => ({
      pokemonSvc: scope.getPokemonSvc(),
      loggerSvc: scope.getLoggerSvc(),
    }))
    .register(async (req) => {
      req.injected.loggerSvc.log(`tenant id from x-tenant-id header = ${req.headers["x-tenant-id"]}`);
      const pokemon = req.injected.pokemonSvc.getPokemon(parseInt(req.pathParams.id, 10));
      if (!pokemon) {
        return { code: HttpStatusCode.NotFound_404, body: { userMessage: `Pokemon with ID ${req.pathParams.id} not found` } };
      }
      // const pokemon: Pokemon = {
      //   id: 1,
      //   name: "Bulbasaur",
      //   type: "grass",
      //   description: "A grass-type Pokémon."
      // };
      return {
        code: HttpStatusCode.OK_200,
        body: pokemon
      };
    });

  // reg._middlewareRegistry

  route(pokedexApiReg, 'POST /pokemons')
    .inject((scope) => ({
      loggerSvc: scope.getLoggerSvc(),
    }))
    .register(async (req) => {
      // TODO: typesafe req.headers, now is :Record<string, string>
      req.injected.loggerSvc.log(`ROUTE HANDLER: tenant id from x-tenant-id header = ${req.headers['x-tenant-id']}, body tenant id = ${req.body.tenantId}`);
      return {
        code: HttpStatusCode.Created_201,
        body: 999
      };
    });

  const testContainer = dicontainer.createTestClone()
    .override('LoggerSvc', () => {
      const prefix = '[LOG-TEST]: ';
      return ({
        log: (msg: string) => { 
          return `${prefix}${msg}`;
        }
      });
    }) // the register override order does not matter
    .override('PokemonSvc', (c) => new PokemonService(c.getLoggerSvc()));

  const client = createInProcApiClient(pokedexApiContract, testContainer, pokedexApiReg);

  test('first', async () => {
    const result = await client.pokemons.id('25').GET({
      headers: {
        "x-tenant-id": "XXX",
      }
    });
    expect(result.code).toBe(HttpStatusCode.OK_200);
    if (result.code === HttpStatusCode.OK_200) {
      expect(result.body).toEqual({
        tenantId: 'XXX',
        id: 25,
        name: "Bulbasaur",
        type: "grass",
        description: "A grass-type Pokémon."
      });
    } else {
      expect.fail(`Unexpected status code: ${result.code}`);
    }
  })
});