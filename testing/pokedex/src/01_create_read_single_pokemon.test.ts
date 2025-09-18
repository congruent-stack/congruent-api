import { expect, test, describe, assert } from 'vitest';
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
  const InternalServerErrorSchema = z.object({
    traceid: z.string(),
  });

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
    entity: z.string(),
    entityIdentifiers: z.record(z.string(), z.string()),
  });

  const CommonBadRequestSchema = z.object({
    details: z.string()
  });

  const UnprocessableEntitySchema = z.object({
    fieldErrors: z.array(z.object({ field: z.string(), message: z.string() })),
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
              location: z.url().describe("URL of the created resource"),
              'x-custom-response-header': z.string(),
            }),
            body: z.number().int() 
          }),
          [HttpStatusCode.BadRequest_400]: response({ 
            body: z.union([
              CommonBadRequestSchema, 
              z.object({
                userDetails: z.string(),
              })
            ])
          }),
          [HttpStatusCode.NotFound_404]: response({ body: NotFoundSchema }),
          [HttpStatusCode.UnprocessableEntity_422]: response({ body: UnprocessableEntitySchema }),
          [HttpStatusCode.InternalServerError_500]: response({ body: InternalServerErrorSchema }),
        }
      }),
      [':id']: {
        GET: endpoint({
          headers: CommonHeadersSchema,
          responses: {
            [HttpStatusCode.OK_200]: response({ body: PokemonSchema }),
            [HttpStatusCode.NotFound_404]: response({ body: NotFoundSchema }),
            [HttpStatusCode.BadRequest_400]: response({ body: CommonBadRequestSchema }),
            [HttpStatusCode.InternalServerError_500]: response({ body: InternalServerErrorSchema }),
          },
        }),
      }
    }
  });

  type Tenant = { id: number; name: string; };

  function createTenantsCollection(): Tenant[] {
    return [
      { id: 1, name: 'Tenant 1' },
      { id: 2, name: 'Tenant 2' },
    ];
  }

  function createPokemonsCollection(): Pokemon[] {
    return [
      { id: 1, name: 'Bulbasaur', description: 'Grass type', type: 'grass', tenantId: 1 },
      { id: 2, name: 'Ivysaur', description: 'Grass type', type: 'grass', tenantId: 1 },
      { id: 3, name: 'Venusaur', description: 'Grass type', type: 'grass', tenantId: 2 },
      { id: 4, name: 'Charmander', description: 'Fire type', type: 'fire', tenantId: 2 },
      { id: 5, name: 'Charmeleon', description: 'Fire type', type: 'fire', tenantId: 2 },
      { id: 6, name: 'Charizard', description: 'Fire type', type: 'fire', tenantId: 2 },
    ];
  }

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

  class TenantsService {
    private _tenantCollection: Tenant[];
    constructor(tenantCollection: Tenant[]) {
      this._tenantCollection = tenantCollection;
    }

    findTenantById(id: number): Tenant | null {
      return this._tenantCollection.find(t => t.id === id) || null;
    }
  }

  class PokemonsService {
    private _pokemonCollection: Pokemon[];
    constructor(pokemonCollection: Pokemon[]) {
      this._pokemonCollection = pokemonCollection;
    }
    findPokemonById(id: number): Pokemon | null {
      return this._pokemonCollection.find(p => p.id === id) || null;
    }
    createPokemon(pokemon: Omit<Pokemon, 'id'>): Pokemon {
      const newPokemon = { ...pokemon, id: this._pokemonCollection.length + 1 };
      this._pokemonCollection.push(newPokemon);
      return newPokemon;
    }
    listPokemonsByTenantId(tenantId: number): Pokemon[] {
      return this._pokemonCollection.filter(p => p.tenantId === tenantId);
    }
  }

  const dicontainer = new DIContainer()
    .register('TenantsCollection', () => createTenantsCollection(), 'singleton')
    .register('TenantsService', (scope) => new TenantsService(scope.getTenantsCollection()), 'singleton')
    .register('TenantStore', () => new TenantStore(), 'scoped')
    .register('TenantProvider', (scope) => scope.getTenantStore() as ITenantProvider, 'scoped')
    .register('SomeOtherService', (scope) => new SomeOtherService(scope.getTenantStore()), 'scoped')
    .register('PokemonsCollection', () => createPokemonsCollection(), 'singleton')
    .register('PokemonsService', (scope) => new PokemonsService(scope.getPokemonsCollection()), 'singleton');

  const registry = createRegistry(dicontainer, contract, {
    handlerRegisteredCallback: (_entry) => {
      // console.log(`Handler registered for ${entry.methodEndpoint.method} ${entry.methodEndpoint.genericPath}`);
    },
    middlewareHandlerRegisteredCallback: (_entry) => {
      // console.log(`Middleware handler registered for ${entry.genericPath}`);
    }
  });

  middleware(registry, '/pokemons')
    .inject((scope) => ({
      tenantsService: scope.getTenantsService(),
      tenantStore: scope.getTenantStore(),
      someOtherService: scope.getSomeOtherService(),
    }))
    .register({
      headers: CommonHeadersSchema,
      responses: {
        [HttpStatusCode.BadRequest_400]: response({ body: CommonBadRequestSchema }),
        [HttpStatusCode.NotFound_404]: response({ body: NotFoundSchema }),
      }
    }, async (req, next) => {
      if (!req.headers['x-tenant-id']) {
        return { code: HttpStatusCode.BadRequest_400, body: { details: 'Missing X-Tenant-ID header' } };
      }
      const tenantId = parseInt(req.headers['x-tenant-id'], 10);
      if (isNaN(tenantId)) {
        return { code: HttpStatusCode.BadRequest_400, body: { details: `Invalid Tenant ID` } };
      }
      const tenant = req.injected.tenantsService.findTenantById(tenantId);
      if (!tenant) {
        return { 
          code: HttpStatusCode.NotFound_404, 
          body: { 
            entity: `Tenant`, 
            entityIdentifiers: { 
              id: tenantId.toString() 
            } 
          } 
        };
      }
      req.injected.tenantStore.setTenant(tenant);
      next();
    });

  route(registry, 'POST /pokemons')
    .inject((scope) => ({
      tenantProvider: scope.getTenantProvider(),
      someOtherService: scope.getSomeOtherService(),
      pokemonsService: scope.getPokemonsService(),
    }))
    .register(async (req) => {
      if (req.injected.tenantProvider.getUUID() !== req.injected.someOtherService.tenantStore.getUUID()) {
        throw new Error('SomeOtherService has different uuid than TenantProvider');
      }
      const tenantid = req.injected.tenantProvider.getTenant().id;
      if (req.injected.someOtherService.tenantStore.getTenant().id !== tenantid) {
        throw new Error('SomeOtherService has different tenant than TenantProvider');
      }
      // const newPokemon = {
      //   id: pokemons.length + 1,
      //   tenantId: req.injected.tenantProvider.getTenant().id,
      //   ...req.body,
      // };
      // pokemons.push(newPokemon);
      const newPokemon = req.injected.pokemonsService.createPokemon({
        tenantId: tenantid,
        ...req.body,
      });
      if (false) {
        return {
          code: HttpStatusCode.BadRequest_400,
          body: { userDetails: 'you did something wrong' }
        }
      }
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
    .inject((scope) => ({
      tenantProvider: scope.getTenantProvider(),
      pokemonsService: scope.getPokemonsService(),
    }))
    .register(async (req) => {
      const pokemonId = parseInt(req.pathParams.id, 10);
      if (isNaN(pokemonId) || pokemonId < 1) {
        return { 
          code: HttpStatusCode.BadRequest_400, 
          body: { details: `Invalid Pokemon ID ${req.pathParams.id}` }
        };
      }
      //const pokemon = pokemons.find(p => p.id === pokemonId);
      const pokemon = req.injected.pokemonsService.findPokemonById(pokemonId);
      if (!pokemon) {
        return { 
          code: HttpStatusCode.NotFound_404, 
          body: { 
            entity: `Pokemon`, 
            entityIdentifiers: { 
              id: pokemonId.toString() 
            } 
          } 
        };
      }
      return { code: HttpStatusCode.OK_200, body: pokemon };
    });

  test('happy path POST /api/v1/pokemons & GET /api/v1/pokemons/:id', async () => {
    const testContainer = dicontainer.createTestClone()
      .override('TenantsCollection', () => createTenantsCollection())
      .override('TenantsService', (scope) => new TenantsService(scope.getTenantsCollection()))
      .override('TenantStore', () => new TenantStore())
      .override('TenantProvider', (scope) => scope.getTenantStore() as ITenantProvider)
      .override('SomeOtherService', (scope) => new SomeOtherService(scope.getTenantStore()))
      .override('PokemonsCollection', () => createPokemonsCollection())
      .override('PokemonsService', (scope) => new PokemonsService(scope.getPokemonsCollection()));

    const client = createInProcApiClient(contract, testContainer, registry);
    const outerScope = testContainer.createScope();
    const pokemons = outerScope.getPokemonsCollection();
    expect(pokemons.length).toBe(6);

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
    if (postResponse.code !== HttpStatusCode.Created_201) {
      assert.fail(201, postResponse.code, `Response code does not match`);
    }
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

  test('NotFound 404 GET /api/v1/pokemons/:id', async () => {
    const testContainer = dicontainer.createTestClone()
      .override('TenantsCollection', () => createTenantsCollection())
      .override('TenantsService', (scope) => new TenantsService(scope.getTenantsCollection()))
      .override('TenantStore', () => new TenantStore())
      .override('TenantProvider', (scope) => scope.getTenantStore() as ITenantProvider)
      .override('SomeOtherService', (scope) => new SomeOtherService(scope.getTenantStore()))
      .override('PokemonsCollection', () => createPokemonsCollection())
      .override('PokemonsService', (scope) => new PokemonsService(scope.getPokemonsCollection()));

    const client = createInProcApiClient(contract, testContainer, registry);
    const outerScope = testContainer.createScope();
    const pokemons = outerScope.getPokemonsCollection();
    expect(pokemons.length).toBe(6);
    
    const getResponse = await client.pokemons.id(1000).GET({
      headers: { 'x-tenant-id': '1' }
    });
    if (getResponse.code === HttpStatusCode.OK_200) {
      getResponse.body.name
    }
    if (getResponse.code === HttpStatusCode.NotFound_404) {
      getResponse.body.entity
    }
    if (getResponse.code === HttpStatusCode.BadRequest_400) {
      getResponse.body.details
    }
    if (getResponse.code !== HttpStatusCode.NotFound_404) {
      assert.fail(404, getResponse.code, `Response code does not match`);
    }
    expect(getResponse.body).toEqual({
      entity: "Pokemon",
      entityIdentifiers: {
        id: "1000",
      }
    });
  });

  test('Tenant NotFound 404 POST /api/v1/pokemons', async () => {
    const testContainer = dicontainer.createTestClone()
      .override('TenantsCollection', () => createTenantsCollection())
      .override('TenantsService', (scope) => new TenantsService(scope.getTenantsCollection()))
      .override('TenantStore', () => new TenantStore())
      .override('TenantProvider', (scope) => scope.getTenantStore() as ITenantProvider)
      .override('SomeOtherService', (scope) => new SomeOtherService(scope.getTenantStore()))
      .override('PokemonsCollection', () => createPokemonsCollection())
      .override('PokemonsService', (scope) => new PokemonsService(scope.getPokemonsCollection()));

    const client = createInProcApiClient(contract, testContainer, registry);
    const outerScope = testContainer.createScope();
    const pokemons = outerScope.getPokemonsCollection();
    expect(pokemons.length).toBe(6);
    
    const postResponse = await client.pokemons.POST({
      headers: {
        'x-tenant-id': '1000',
        'x-custom-header': 'some-value',
      },
      body: {
        name: 'Bulbasaur',
        type: 'grass',
        description: 'A grass-type Pokémon.'
      }
    });
    if (postResponse.code !== HttpStatusCode.NotFound_404) {
      assert.fail(404, postResponse.code, `Response code does not match`);
    }
    expect(postResponse.body).toEqual({
      entity: "Tenant",
      entityIdentifiers: {
        id: "1000",
      }
    });
  });
});