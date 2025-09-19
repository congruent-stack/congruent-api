import { ICanTriggerAsync } from "./api_can_trigger.js";
import { createClient } from "./api_client.js";
import { ApiContract, IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry, createRegistry, flatListAllRegistryEntries } from "./api_handlers_registry.js";
import { MiddlewareHandlersRegistry } from "./api_middleware.js";
import { execMiddleware } from "./api_middleware_exec.js";
import { route } from "./api_routing.js";
import { DIContainer, DIContainerTestClone } from "./di_container_2.js";

export function createInProcApiClient<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>,
  TDIContainer extends DIContainer,
  TDIContainerTestClone extends DIContainerTestClone<any, TDIContainer>
>(
  contract: ApiContract<TDef>,
  testContainer: TDIContainerTestClone,
  registry: ApiHandlersRegistry<TDef, TDIContainer>
) 
{
  const mwHandlers: ICanTriggerAsync[] = [];
  const mwReg = registry._middlewareRegistry as MiddlewareHandlersRegistry<TDIContainer>;
  mwReg.list.forEach(mwEntry => {
    mwHandlers.push(mwEntry);
  });

  const client = createClient<TDef>(contract, async (input) => {
    const diScope = testContainer.createScope();
    const allHandlerEntries: ICanTriggerAsync[] = [...mwHandlers];
    const endpointHandlerEntry = route(registry, `${input.method} ${input.genericPath}` as any);
    if (!endpointHandlerEntry.handler) {
      throw new Error(`No handler registered for ${input.method} ${input.genericPath}`);
    }
    allHandlerEntries.push(endpointHandlerEntry);
    const response = await execMiddleware(diScope, allHandlerEntries, input);
    if (!response) {
      throw new Error(`No response from ${input.method} ${input.genericPath}`);
    }
    return response;
  });

  return client;
};
