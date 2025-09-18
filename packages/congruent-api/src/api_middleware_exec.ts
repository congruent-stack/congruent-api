import { MethodEndpointHandlerRegistryEntry } from "./api_handlers_registry_entry.js";
import { MiddlewareHandlersRegistryEntryInternal } from "./api_middleware.js";
import { DIContainer, DIScope } from "./di_container_2.js";
import { ClientHttpMethodEndpointHandlerInput } from "./http_method_endpoint_handler_input.js";

export async function execMiddleware<TDIContainer extends DIContainer>(
  diScope: DIScope<any>,
  list: Readonly<MiddlewareHandlersRegistryEntryInternal<TDIContainer, unknown>[]>,
  final: Readonly<MethodEndpointHandlerRegistryEntry<any, TDIContainer, any, any>>,
  input: ClientHttpMethodEndpointHandlerInput
): Promise<any> {
  const queue = [...list, final];
  let response: any = undefined;

  const next = async (): Promise<any> => {
    if (response) {
      // TODO: not sure if this shortcircuit is needed here
      return;
    }
    const current = queue.shift();
    if (!current) {
      // shortcircuit: no more middleware/handler to execute
      return;
    }
    const currResponse = await current.trigger(
      diScope,
      {
        headers: input.headers,
        pathParams: input.pathParams,
        body: input.body,
        query: input.query,
      },
      next // final does not have a third parameter, so it will be ignored there
    );
    if (response) {
      // shortcircuit: avoid calling next when response is already set
      return;
    }
    if (currResponse) {
      response = currResponse;
      return;
    }
    await next();
  };

  await next();

  return response;
}