import { createClient } from "./api_client.js";
import { ApiContract, IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry, createRegistry, flatListAllRegistryEntries } from "./api_handlers_registry.js";
import { MiddlewareHandlersRegistry } from "./api_middleware.js";
import { execMiddleware } from "./api_middleware_exec.js";
import { route } from "./api_routing.js";
import { DIContainer } from "./di_container.js";

export function createInProcApiClient<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>,
  TDIContainer extends DIContainer
>(
  contract: ApiContract<TDef>,
  testContainer: TDIContainer,
  registry: ApiHandlersRegistry<TDef, TDIContainer>
) 
{
  const testApiReg = createRegistry(testContainer, contract, {
    handlerRegisteredCallback: (_entry) => {
      //console.log('Registering TEST route:', entry.methodEndpoint.genericPath);
    },
    middlewareHandlerRegisteredCallback: (_entry) => {
      //console.log('Registering TEST middleware:', entry.genericPath);
    },
  });

  (registry._middlewareRegistry as MiddlewareHandlersRegistry<TDIContainer>).list.forEach(mwEntry => {
    (testApiReg._middlewareRegistry as MiddlewareHandlersRegistry<TDIContainer>).register(mwEntry as any);
  });

  const mwReg = testApiReg._middlewareRegistry as MiddlewareHandlersRegistry<TDIContainer>;

  flatListAllRegistryEntries(registry).forEach(entry => {
    if (!entry.handler) {
      return;
    }
    const rt = route(testApiReg, `${entry.methodEndpoint.method} ${entry.methodEndpoint.genericPath}` as any);
    rt.inject(entry.injection)
      .register(entry.handler);
  });

  const client = createClient<TDef>(contract, async (input) => {
    const diScope = testContainer.createScope();
    const halttedExecresponse = await execMiddleware(diScope, mwReg.list, input);
    if (halttedExecresponse) {
      return halttedExecresponse;
    }
    const rt = route(testApiReg, `${input.method} ${input.genericPath}` as any);
    const result = await rt.trigger(diScope, {
      headers: input.headers,
      pathParams: input.pathParams,
      body: input.body ?? {},
      query: input.query ?? {},
    });
    return result;
  });
  return client;
};
