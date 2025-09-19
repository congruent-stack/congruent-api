import { ICanTriggerAsync } from "./api_can_trigger.js";
import { DIScope } from "./di_container_2.js";
import { ClientHttpMethodEndpointHandlerInput } from "./http_method_endpoint_handler_input.js";

export async function execMiddleware(
  diScope: DIScope<any>,
  allHandlerEntries: ICanTriggerAsync[],
  input: ClientHttpMethodEndpointHandlerInput
): Promise<any> {
  const queue = [...allHandlerEntries];
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
    if (!input.genericPath.startsWith(current.genericPath)) {
      // skip this middleware/handler as it does not match the current route
      await next();
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