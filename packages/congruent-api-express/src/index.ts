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
  isHttpResponseObject,
  triggerEndpointDecoratorNoStaticTypeCheck,
  triggerMiddlewareDecoratorNoStaticTypeCheck
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
      if (typeof app[method] !== 'function') {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }
      const routeHandlers: RequestHandler[] = [];
      entry.decoratorFactories.forEach(decoratorFactory => {
        routeHandlers.push(async (req, res, next) => {
          if (!res.locals.diScope) {
            res.locals.diScope = entry.dicontainer.createScope();
          }
          // @ts-ignore
          req.pathParams = req.params;
          const decorator = decoratorFactory(res.locals.diScope);
          const haltResult = await triggerEndpointDecoratorNoStaticTypeCheck(
            entry.methodEndpoint,
            decorator,
            req as any,
            {
              next: next as () => Promise<void>,
              originalRequest: req
            }
          );
          if (haltResult && isHttpResponseObject(haltResult)) {
            const haltResultHeaders = new Map(
              Object.entries(haltResult.headers || {})
            ) as Map<string, string | number | readonly string[]>;
            res.status(haltResult.code)
              .setHeaders(haltResultHeaders)
              .json(haltResult.body);
          }
        });
      });
      routeHandlers.push(async (req, res) => {
        if (!res.locals.diScope) {
          res.locals.diScope = entry.dicontainer.createScope();
        }
        // @ts-ignore
        req.pathParams = req.params;
        const result = await entry.triggerNoStaticTypeCheck(
          res.locals.diScope, 
          req as any,
          {
            originalRequest: req
          }
        );
        const resultHeaders = new Map(
          Object.entries(result.headers || {})
        ) as Map<string, string | number | readonly string[]>;
        res.status(result.code)
          .setHeaders(resultHeaders)
          .json(result.body);
      });
      app[method](genericPath, ...routeHandlers);
    },
    middlewareHandlerRegisteredCallback: (entry) => {
      const { /*TODO: method,*/ genericPath } = entry;
      const middlewareHandlers: RequestHandler[] = [];
      entry.decoratorFactories.forEach(decoratorFactory => {
        middlewareHandlers.push(async (req, res, next) => {
          if (!res.locals.diScope) {
            res.locals.diScope = entry.dicontainer.createScope();
          }
          // @ts-ignore
          req.pathParams = req.params;
          const decorator = decoratorFactory(res.locals.diScope);
          const haltResult = await triggerMiddlewareDecoratorNoStaticTypeCheck(
            entry,
            decorator,
            req as any,
            {
              next: next as () => Promise<void>,
              originalRequest: req
            }
          );
          if (haltResult && isHttpResponseObject(haltResult)) {
            const haltResultHeaders = new Map(
              Object.entries(haltResult.headers || {})
            ) as Map<string, string | number | readonly string[]>;
            res.status(haltResult.code)
              .setHeaders(haltResultHeaders)
              .json(haltResult.body);
          }
        });
      });
      middlewareHandlers.push(async (req, res, next) => {
        if (!res.locals.diScope) {
          res.locals.diScope = entry.dicontainer.createScope();
        }
        // @ts-ignore
        req.pathParams = req.params;
        const haltResult = await entry.triggerNoStaticTypeCheck(
          res.locals.diScope, 
          req as any, 
          { 
            next: next as () => Promise<void>,
            originalRequest: req
          }
        );
        if (haltResult && isHttpResponseObject(haltResult)) {
          const haltResultHeaders = new Map(
            Object.entries(haltResult.headers || {})
          ) as Map<string, string | number | readonly string[]>;
          res.status(haltResult.code)
            .setHeaders(haltResultHeaders)
            .json(haltResult.body);
        }
      });
      app.use(genericPath, ...middlewareHandlers);
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