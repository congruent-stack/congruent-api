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
  route 
} from '@congruent-stack/congruent-api';

describe('Create and Read a single Pokemon', () => {

  const PokemonSchema = z.object({
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

  const NotFoundSchema = z.object({
    userMessage: z.string(),
  });

  const contract = apiContract({
    pokemons: {
      POST: endpoint({
        headers: z.object({
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
            responses: {
              [HttpStatusCode.OK_200]: response({ body: PokemonSchema }),
              [HttpStatusCode.NotFound_404]: response({ body: NotFoundSchema }),
            },
          }
        ),
      }
    }
  });
  const dicontainer = new DIContainer();
  const registry = createRegistry(dicontainer, contract, {
    handlerRegisteredCallback: (_entry) => {
      // console.log(`Handler registered for ${entry.methodEndpoint.method} ${entry.methodEndpoint.genericPath}`);
    },
    middlewareHandlerRegisteredCallback: (_entry) => {
      // console.log(`Middleware handler registered for ${entry.genericPath}`);
    }
  });

  route(registry, 'POST /pokemons')
    .register(async (req) => {
      const newPokemon = {
        id: pokemons.length + 1,
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

  const pokemons: Pokemon[] = [
    { id: 1, name: 'Bulbasaur', description: 'Grass type', type: 'grass' },
    { id: 2, name: 'Ivysaur', description: 'Grass type', type: 'grass' },
    { id: 3, name: 'Venusaur', description: 'Grass type', type: 'grass' },
    { id: 4, name: 'Charmander', description: 'Fire type', type: 'fire' },
    { id: 5, name: 'Charmeleon', description: 'Fire type', type: 'fire' },
    { id: 6, name: 'Charizard', description: 'Fire type', type: 'fire' },
  ];

  const client = createInProcApiClient(contract, dicontainer, registry);

  test('POST /api/v1/pokemons & GET /api/v1/pokemons/:id', async () => {
    const createResponse = await client.pokemons.POST({
      headers: {
        'x-custom-header': 'some-value',
      },
      body: {
        name: 'Bulbasaur',
        type: 'grass',
        description: 'A grass-type Pokémon.'
      }
    });
    expect(createResponse.code).toBe(HttpStatusCode.Created_201);
    expect(createResponse.body).toBe(7);
    expect(createResponse.headers.location).toBe('/pokemons/7');
    expect(pokemons.length).toBe(7);
    expect(pokemons[6].name).toBe('Bulbasaur');

    const getResponse = await client.pokemons.id(7).GET();
    expect(getResponse.code).toBe(HttpStatusCode.OK_200);
    expect(getResponse.body).toEqual({
      id: 7,
      name: 'Bulbasaur',
      type: 'grass',
      description: 'A grass-type Pokémon.'
    });
  });
});