import { ICanTriggerAsync } from "./api_can_trigger.js";
import { createClient } from "./api_client.js";
import { ApiContract, IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry } from "./api_handlers_registry.js";
import { MiddlewareHandlersRegistry } from "./api_middleware.js";
import { execHandlerChain } from "./api_exec_handler_chain.js";
import { route } from "./api_routing.js";
import { DIContainer, DIContainerTestClone, DIScope } from "./di_container.js";
import { HttpResponseObject } from "./http_method_endpoint_handler_output.js";
import { ClientHttpMethodEndpointHandlerInput } from "./http_method_endpoint_handler_input.js";
import { triggerDecoratorNoStaticTypeCheck } from "./endpoint_handler_decorator.js";

export interface InProcApiClientOptions<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>,
  TDIContainer extends DIContainer
> {
  enhanceRequest?: (input: ClientHttpMethodEndpointHandlerInput) => ClientHttpMethodEndpointHandlerInput;
  filterMiddleware?: (genericPath: string, middlewareIndex: number) => boolean;
  mockEndpointResponse?: (genericPath: string, method: string, diScope: ReturnType<TDIContainer['createScope']>) => HttpResponseObject | null;
}

export function createInProcApiClient<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>,
  TDIContainer extends DIContainer,
  TDIContainerTestClone extends DIContainerTestClone<any, TDIContainer>
>(
  contract: ApiContract<TDef>,
  testContainer: TDIContainerTestClone,
  registry: ApiHandlersRegistry<TDef, TDIContainer>,
  options?: InProcApiClientOptions<TDef, TDIContainer>
) 
{
  const mwHandlers: ICanTriggerAsync[] = [];
  const mwReg = registry._middlewareRegistry as MiddlewareHandlersRegistry<TDIContainer>;
  const mwNdx = 0;
  for (const mwEntry of mwReg.list) {
    if (!options?.filterMiddleware) {
      mwHandlers.push(mwEntry);
      continue;
    }
    const isIncluded = options.filterMiddleware(mwEntry.genericPath, mwNdx);
    if (!isIncluded) {
      continue;
    }
    mwHandlers.push(mwEntry);
  }

  const client = createClient<TDef>(contract, async (input) => {
    if (options?.enhanceRequest) {
      input = options.enhanceRequest(input);
    }
    const diScope = testContainer.createScope();
    const allHandlerEntries: ICanTriggerAsync[] = [...mwHandlers];
    const endpointHandlerEntry = route(registry, `${input.method} ${input.genericPath}` as any);
    if (!endpointHandlerEntry.handler) {
      throw new Error(`No handler registered for ${input.method} ${input.genericPath}`);
    }
    endpointHandlerEntry.decoratorFactories.forEach((decoratorFactory) => {
      allHandlerEntries.push({
        genericPath: endpointHandlerEntry.genericPath,
        triggerNoStaticTypeCheck: async (diScope: DIScope<any>, requestObject, next) => {
          const decorator = decoratorFactory(diScope);
          return await triggerDecoratorNoStaticTypeCheck(
            endpointHandlerEntry.methodEndpoint,
            decorator,
            requestObject,
            next!
          );
        }
      });
    });
    if (options?.mockEndpointResponse) {
      const mockResponse = options.mockEndpointResponse(input.genericPath, input.method, diScope as any);
      if (mockResponse) {
        allHandlerEntries.push({
          genericPath: endpointHandlerEntry.genericPath,
          triggerNoStaticTypeCheck: async (_diScope, _requestObject, _next) => {
            return mockResponse;
          }
        });
      } else {
        allHandlerEntries.push(endpointHandlerEntry);
      }
    } else {
      allHandlerEntries.push(endpointHandlerEntry);
    }
    const response = await execHandlerChain(diScope, allHandlerEntries, input);
    if (!response) {
      throw new Error(`No response from ${input.method} ${input.genericPath}`);
    }
    return response;
  });

  return client;
};
