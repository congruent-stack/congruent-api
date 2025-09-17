import { expect, test, describe } from 'vitest';
import { z } from 'zod';
import { 
  HttpStatusCode,
  DIContainer,  
  apiContract, 
  createInProcApiClient, 
  createRegistry, 
  endpoint, 
  response, 
  route,
  middleware
} from '@congruent-stack/congruent-api';

describe('Create and Read a single Pokemon', () => {
  const CommonHeadersSchema = z.object({
    'x-tenant-id': z.string(),
  });

  const PokemonSchema = z.object({
    tenantId: z.number().int().min(1),
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

  const CreatePokemonSchema = PokemonSchema.omit({ id: true, tenantId: true });

  const NotFoundSchema = z.object({
    userMessage: z.string(),
  });

  const contract = apiContract({
    pokemons: {
      POST: endpoint({
        headers: CommonHeadersSchema.extend({
          'x-custom-header': z.string(),
        }),
        body: CreatePokemonSchema,
        responses: {
          [HttpStatusCode.Created_201]: response({
            headers: z.object({
              'location': z.string(),
              'x-custom-response-header': z.string(),
            }),
            body: z.number().int() 
          }),
        }
      }),
      [':id']: {
        GET: endpoint({
          headers: CommonHeadersSchema,
          responses: {
            [HttpStatusCode.OK_200]: response({ body: PokemonSchema }),
            [HttpStatusCode.NotFound_404]: response({ body: NotFoundSchema }),
          },
        }),
      }
    }
  });

  interface ITenantProvider {
    getTenant(): Tenant;
    getUUID(): string;
  }

  class TenantStore implements ITenantProvider {
    public readonly uuid: string;
    getUUID(): string {
      return this.uuid;
    }

    constructor() {
      this.uuid = crypto.randomUUID();
      // console.log('TenantStore created', this.uuid);
    }
    
    private _tenant: Tenant | null = null;
    setTenant(tenant: Tenant) {
      this._tenant = tenant;
    }
    getTenant(): Tenant {
      if (!this._tenant) {
        throw new Error('Tenant not set');
      }
      return this._tenant;
    }
  }

  class SomeOtherService {
    public readonly uuid: string;
    public readonly tenantStore: TenantStore;
    constructor(tenantStore: TenantStore) {
      this.uuid = crypto.randomUUID();
      this.tenantStore = tenantStore;
      // console.log('SomeOtherService created', this.uuid, 'with TenantStore', tenantStore.uuid);
    }
  }

  const dicontainer = new DIContainer()
    .register('TenantStore', () => new TenantStore(), 'scoped')
    .register('TenantProvider', (c) => {
      return c.getTenantStore() as ITenantProvider
    }, 'scoped')
    .register('SomeOtherService', (c) => {
      return new SomeOtherService(c.getTenantStore());
    }, 'scoped');

  const registry = createRegistry(dicontainer, contract, {
    handlerRegisteredCallback: (_entry) => {
      // console.log(`Handler registered for ${entry.methodEndpoint.method} ${entry.methodEndpoint.genericPath}`);
    },
    middlewareHandlerRegisteredCallback: (_entry) => {
      // console.log(`Middleware handler registered for ${entry.genericPath}`);
    }
  });

  middleware(registry, '/pokemons')
    .inject((c) => ({
      tenantStore: c.getTenantStore(),
      someOtherService: c.getSomeOtherService(),
    }))
    .register({
      headers: CommonHeadersSchema,
    }, async (req, next) => {
      if (!req.headers['x-tenant-id']) {
        return { code: HttpStatusCode.BadRequest_400, body: { userMessage: 'Missing X-Tenant-ID header' } };
      }
      const tenantId = parseInt(req.headers['x-tenant-id'], 10);
      if (isNaN(tenantId) || !tenants.find(t => t.id === tenantId)) {
        return { code: HttpStatusCode.BadRequest_400, body: { userMessage: `Invalid Tenant ID` } };
      }
      const tenant = tenants.find(t => t.id === tenantId);
      if (!tenant) {
        return { code: HttpStatusCode.NotFound_404, body: { userMessage: `Tenant not found` } };
      }
      req.injected.tenantStore.setTenant(tenant);
      next();
    });

  route(registry, 'POST /pokemons')
    .inject((c) => ({
      tenantProvider: c.getTenantProvider(),
      someOtherService: c.getSomeOtherService(),
    }))
    .register(async (req) => {
      if (req.injected.tenantProvider.getUUID() !== req.injected.someOtherService.tenantStore.getUUID()) {
        throw new Error('SomeOtherService has different uuid than TenantProvider');
      }
      const tenantid = req.injected.tenantProvider.getTenant().id;
      if (req.injected.someOtherService.tenantStore.getTenant().id !== tenantid) {
        throw new Error('SomeOtherService has different tenant than TenantProvider');
      }
      const newPokemon = {
        id: pokemons.length + 1,
        tenantId: req.injected.tenantProvider.getTenant().id,
        ...req.body,
      };
      pokemons.push(newPokemon);
      return {
        code: HttpStatusCode.Created_201,
        headers: {
          'location': route(registry, `GET /pokemons/:id`).methodEndpoint.genericPath.replace(':id', newPokemon.id.toString()),
          'x-custom-response-header': 'some-value',
          'x-inexistant-custom-response-header': 'foo',
        },
        body: newPokemon.id,
      };
    });

  route(registry, 'GET /pokemons/:id')
    .inject((c) => ({
      tenantProvider: c.getTenantProvider(),
    }))
    .register(async (req) => {
      const pokemonId = parseInt(req.pathParams.id, 10);
      if (isNaN(pokemonId) || pokemonId < 1) {
        return { code: HttpStatusCode.NotFound_404, body: { userMessage: `Invalid Pokemon ID ${req.pathParams.id}` } };
      }
      const pokemon = pokemons.find(p => p.id === pokemonId);
      if (!pokemon) {
        return { code: HttpStatusCode.NotFound_404, body: { userMessage: `Pokemon with ID ${req.pathParams.id} not found` } };
      }
      return { code: HttpStatusCode.OK_200, body: pokemon };
    });

  type Tenant = { id: number; name: string; };

  const tenants: Tenant[] = [
    { id: 1, name: 'Tenant 1' },
    { id: 2, name: 'Tenant 2' },
  ];

  const pokemons: Pokemon[] = [
    { id: 1, name: 'Bulbasaur', description: 'Grass type', type: 'grass', tenantId: 1 },
    { id: 2, name: 'Ivysaur', description: 'Grass type', type: 'grass', tenantId: 1 },
    { id: 3, name: 'Venusaur', description: 'Grass type', type: 'grass', tenantId: 2 },
    { id: 4, name: 'Charmander', description: 'Fire type', type: 'fire', tenantId: 2 },
    { id: 5, name: 'Charmeleon', description: 'Fire type', type: 'fire', tenantId: 2 },
    { id: 6, name: 'Charizard', description: 'Fire type', type: 'fire', tenantId: 2 },
  ];

  const testContainer = dicontainer.createTestClone()
    .override('TenantStore', () => new TenantStore())
    .override('TenantProvider', (c) => c.getTenantStore() as ITenantProvider)
    .override('SomeOtherService', (c) => new SomeOtherService(c.getTenantStore()));

  const client = createInProcApiClient(contract, testContainer, registry);

  test('POST /api/v1/pokemons & GET /api/v1/pokemons/:id', async () => {
    const postResponse = await client.pokemons.POST({
      headers: {
        'x-tenant-id': '1',
        'x-custom-header': 'some-value',
      },
      body: {
        name: 'Bulbasaur',
        type: 'grass',
        description: 'A grass-type Pokémon.'
      }
    });
    expect(postResponse.code).toBe(HttpStatusCode.Created_201);
    expect(postResponse.body).toBe(7);
    expect(postResponse.headers.location).toBe('/pokemons/7');
    expect(pokemons.length).toBe(7);
    expect(pokemons[6].name).toBe('Bulbasaur');

    const getResponse = await client.pokemons.id(7).GET({
      headers: { 'x-tenant-id': '1' }
    });
    expect(getResponse.code).toBe(HttpStatusCode.OK_200);
    expect(getResponse.body).toEqual({
      id: 7,
      name: 'Bulbasaur',
      type: 'grass',
      description: 'A grass-type Pokémon.',
      tenantId: 1
    });
  });
});