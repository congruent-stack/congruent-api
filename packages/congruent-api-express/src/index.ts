import { 
  Express,
  RequestHandler,
} from 'express';

import {
  type LowerCasedHttpMethod,
  IApiContractDefinition,
  ValidateApiContractDefinition,
  createRegistry,
  ApiContract,
  PrepareRegistryEntryCallback,
  IHttpMethodEndpointDefinition,
  ValidateHttpMethodEndpointDefinition,
  DIContainer,
  isHttpResponseObject
} from '@congruent-stack/congruent-api';

export function createExpressRegistry<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>,
  TDIContainer extends DIContainer
>(
  app: Express,
  diContainer: TDIContainer,
  apiContract: ApiContract<TDef>
) {
  const registry = createRegistry<TDef, TDIContainer>(diContainer, apiContract, {
    handlerRegisteredCallback: (entry) => {
      const { genericPath } = entry.methodEndpoint;
      const method = entry.methodEndpoint.method.toLowerCase() as LowerCasedHttpMethod;
      app[method](genericPath, async (req, res) => {
        // @ts-ignore
        req.pathParams = req.params;
        const result = await entry.trigger(req as any);
        const resultHeaders = new Map(
          Object.entries(result.headers || {})
        ) as Map<string, string | number | readonly string[]>;
        res.status(result.code)
          .setHeaders(resultHeaders)
          .json(result.body);
      });
    },
    middlewareHandlerRegisteredCallback: (entry) => {
      app.use(entry.genericPath, async (req, res, next) => {
        // @ts-ignore
        req.pathParams = req.params;
        const haltResult = await entry.trigger(req as any, next);
        if (haltResult && isHttpResponseObject(haltResult)) {
          const haltResultHeaders = new Map(
            Object.entries(haltResult.headers || {})
          ) as Map<string, string | number | readonly string[]>;
          res.status(haltResult.code)
            .setHeaders(haltResultHeaders)
            .json(haltResult.body);
        }
      });
    }
  });
  return registry;
}

export function expressPreHandler<
  TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string
> (
  app: Express,
  prehandler: RequestHandler
): PrepareRegistryEntryCallback<TDef, TDIContainer, TPathParams> {
  return (({ methodEndpoint: { lowerCasedMethod, genericPath }}) => {
    app[lowerCasedMethod](genericPath, prehandler);
  });
}