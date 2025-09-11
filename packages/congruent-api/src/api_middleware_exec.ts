import { MiddlewareHandlersRegistryEntryInternal } from "./api_middleware.js";
import { DIContainer, DIScope } from "./di_container.js";
import { ClientHttpMethodEndpointHandlerInput } from "./http_method_endpoint_handler_input.js";

export function execMiddleware<TDIContainer extends DIContainer>(
  diScope: DIScope<any>,
  list: Readonly<MiddlewareHandlersRegistryEntryInternal<TDIContainer, unknown>[]>,
  input: ClientHttpMethodEndpointHandlerInput
): any {
  const queue = [...list];

  const next = async (): Promise<any> => {
    const current = queue.shift();
    if (!current) {
      return;
    }
    const result = await current.trigger(
      diScope,
      {
        headers: input.headers,
        pathParams: input.pathParams,
        body: input.body ?? {},
        query: input.query ?? {},
      },
      next
    );
    if (result) {
      return result;
    }
    return next();
  };

  return next();
}