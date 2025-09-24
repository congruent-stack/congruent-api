import { z } from "zod";
import { IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry } from "./api_handlers_registry.js";
import { DIContainer, DIScope } from "./di_container_2.js";
import { HttpMethodEndpoint, HttpMethodEndpointResponses } from "./http_method_endpoint.js";
import { ExtractConcatenatedParamNamesFromPath, TypedPathParams } from "./typed_path_params.js";
import { HttpMethod } from "./http_method_type.js";
import { HttpStatusCode } from "./http_status_code.js";
import { CreateHandlerOutput, HttpResponseObject, isHttpResponseObject } from "./http_method_endpoint_handler_output.js";
import { HttpMethodEndpointResponse } from "./http_method_endpoint_response.js";
import { ICanTriggerAsync } from "./api_can_trigger.js";

export type MiddlewareHandlerSchemas = {
  headers?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  responses: HttpMethodEndpointResponses;
};

export type MiddlewareHandlerInput<
  TPathParams extends string,
  TMiddlewareSchemas extends MiddlewareHandlerSchemas,
  TInjected
> = {
  method: HttpMethod;
  pathSegments: readonly string[];
  path: string;
  genericPath: string;
  headers: TMiddlewareSchemas['headers'] extends z.ZodType ? z.output<TMiddlewareSchemas['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
  pathParams: TypedPathParams<TPathParams>;
  query: TMiddlewareSchemas['query'] extends z.ZodType ? z.output<TMiddlewareSchemas['query']> : null; // z.output because the handler receives the parsed input
  body: TMiddlewareSchemas['body'] extends z.ZodType ? z.output<TMiddlewareSchemas['body']> : null; // z.output because the handler receives the parsed input
  injected: Readonly<TInjected>;
};

export type MiddlewareHandlerOutput<TMiddlewareSchemas extends MiddlewareHandlerSchemas> =
  | void
  | {
    [THttpStatusCode in keyof TMiddlewareSchemas['responses'] & HttpStatusCode]: 
      TMiddlewareSchemas['responses'][THttpStatusCode] extends HttpMethodEndpointResponse<THttpStatusCode, infer TRespDef>
        ? CreateHandlerOutput<THttpStatusCode, TRespDef>
        : never;
  }[keyof TMiddlewareSchemas['responses'] & HttpStatusCode];

export type MiddlewareHandlerInputInternal<TInjected> = {
  method: HttpMethod;
  pathSegments: readonly string[];
  path: string;
  genericPath: string;
  headers: Record<string, string>;
  pathParams: Record<string, string>;
  query: Record<string, any> | null;
  body: Record<string, any> | null;
  injected: Readonly<TInjected>;
};

export type MiddlewareHandler<
  TPathParams extends string,
  TMiddlewareSchemas extends MiddlewareHandlerSchemas,
  TInjected
> = (
  input: MiddlewareHandlerInput<TPathParams, TMiddlewareSchemas, TInjected>,
  next: () => void
) => Promise<MiddlewareHandlerOutput<TMiddlewareSchemas>>;

export type MiddlewareHandlerInternal<TInjected> = (
  input: MiddlewareHandlerInputInternal<TInjected>,
  next: () => void
) => Promise<HttpResponseObject | void>;

export function middleware<
  TApiDef extends IApiContractDefinition & ValidateApiContractDefinition<TApiDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string,
  const TPath extends MiddlewarePath<TApiDef>,
  TInjected = {}
>(
  apiReg: ApiHandlersRegistry<TApiDef, TDIContainer, TPathParams>,
  path: TPath
): MiddlewareHandlersRegistryEntry<TApiDef, TDIContainer, TPathParams, TPath, TInjected> {
  const reg = apiReg._middlewareRegistry as MiddlewareHandlersRegistry<TDIContainer>; // typescript is confused because of type MiddlewareHandlersRegistry<...> | MethodEndpointHandlerRegistryEntry<...>
  const entry = new MiddlewareHandlersRegistryEntry<TApiDef, TDIContainer, TPathParams, TPath, TInjected>(
    reg, path
  );
  return entry;
}

export type MiddlewarePath<TDef, BasePath extends string = ""> =
  | (BasePath extends "" ? "" : never)
  | {
      [K in keyof TDef & string]:
        TDef[K] extends HttpMethodEndpoint<infer _TEndpointDef>
          ? `${K} ${BasePath}`
          : TDef[K] extends object
            ? `${BasePath}/${K}` | MiddlewarePath<TDef[K], `${BasePath}/${K}`>
            : never
    }[keyof TDef & string];

export class MiddlewareHandlersRegistryEntryInternal<
  TDIContainer extends DIContainer,
  TInjected
> implements ICanTriggerAsync {
  
  private readonly _dicontainer: TDIContainer;
  public get dicontainer(): TDIContainer {
    return this._dicontainer;
  }
  
  private readonly _middlewareGenericPath: string;
  public get genericPath(): string {
    return this._middlewareGenericPath;
  }

  private _splitMiddlewarePath(): { method: string; pathSegments: string[] } {
    const splitResult = this._middlewareGenericPath.split(" ");
    let method: string = '';
    let pathSegments: string[] = [];
    if (splitResult.length === 2) {
      method = splitResult[0].trim();
      if (method === '') {
        throw new Error(`Invalid middleware path format: "${this._middlewareGenericPath}". HTTP method is empty.`);
      }
      pathSegments = splitResult[1]
        .split("/")
        .map(segment => segment.trim())
        .filter(segment => segment !== '');
    }
    return {
      method,
      pathSegments
    };
  }

  private readonly _middlewareSchemas: MiddlewareHandlerSchemas;

  private readonly _handler: MiddlewareHandlerInternal<TInjected>;

  constructor(
    diContainer: TDIContainer,
    middlewarePath: string,
    middlewareSchemas: MiddlewareHandlerSchemas,
    injection: (dicontainer: TDIContainer) => TInjected,
    handler: MiddlewareHandlerInternal<TInjected>
  ) {
    this._dicontainer = diContainer;
    this._middlewareGenericPath = middlewarePath;
    this._middlewareSchemas = middlewareSchemas;
    this._injection = injection;
    this._handler = handler;
  }

  private _injection: any = (_dicontainer: TDIContainer) => ({});

  async trigger<
    TPathParams extends string,
    const TMiddlewareSchemas extends MiddlewareHandlerSchemas,
  >(
    diScope: ReturnType<TDIContainer['createScope']>,
    requestObject: { 
      headers: TMiddlewareSchemas['headers'] extends z.ZodType ? z.output<TMiddlewareSchemas['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
      pathParams: TypedPathParams<TPathParams>;
      query: TMiddlewareSchemas['query'] extends z.ZodType ? z.output<TMiddlewareSchemas['query']> : null; // z.output because the handler receives the parsed input
      body: TMiddlewareSchemas['body'] extends z.ZodType ? z.output<TMiddlewareSchemas['body']> : null; // z.output because the handler receives the parsed input
    }, 
    next: () => Promise<void>
  ): Promise<any> {
    return this.triggerNoStaticTypeCheck(diScope, requestObject as any, next);
  }

  async triggerNoStaticTypeCheck(
    diScope: DIScope<any>,
    requestObject: { 
      headers: Record<string, string>,
      pathParams: Record<string, string>,
      query: object,
      body: object,
    }, 
    next: () => Promise<void>
  ): Promise<any> {
    let badRequestResponse: HttpResponseObject | null = null;
    
    const headers = middlewareParseRequestDefinitionField(this._middlewareSchemas, 'headers', requestObject);
    if (isHttpResponseObject(headers)) {
      badRequestResponse = headers;
      return badRequestResponse;
    }

    const query = middlewareParseRequestDefinitionField(this._middlewareSchemas, 'query', requestObject);
    if (isHttpResponseObject(query)) {
      badRequestResponse = query;
      return badRequestResponse;
    }

    const body = middlewareParseRequestDefinitionField(this._middlewareSchemas, 'body', requestObject);
    if (isHttpResponseObject(body)) {
      badRequestResponse = body;
      return badRequestResponse;
    }

    const { method, pathSegments } = this._splitMiddlewarePath();

    const path = `/${pathSegments.map(segment =>
      segment.startsWith(':')
        ? (requestObject.pathParams[segment.slice(1)] ?? '?')
        : segment
    ).join('/')}`;

    return await this._handler(
      { 
        method: method as HttpMethod, // TODO: might be empty, as middleware can be registered with path only, without method, possible fix: take it from express.request.method
        path,
        genericPath: this.genericPath,
        pathSegments: pathSegments,
        headers,
        pathParams: requestObject.pathParams as any, 
        query,
        body,
        injected: this._injection(diScope),
      }, 
      next
    );
  }
}

export class MiddlewareHandlersRegistryEntry<
  TApiDef extends IApiContractDefinition & ValidateApiContractDefinition<TApiDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string,
  const TPath extends MiddlewarePath<TApiDef>,
  TInjected
> {
  private readonly _registry: MiddlewareHandlersRegistry<TDIContainer>;
  private readonly _path: TPath;
  
  constructor(
    registry: MiddlewareHandlersRegistry<TDIContainer>,
    path: TPath
  ) {
    this._registry = registry;
    this._path = path;
  }

  private _injection: any = (_diScope: DIScope<any>) => ({});
  public get injection(): any {
    return this._injection;
  }

  inject<TNewInjected>(injection: (diScope: ReturnType<TDIContainer['createScope']>) => TNewInjected): MiddlewareHandlersRegistryEntry<TApiDef, TDIContainer, TPathParams, TPath, TNewInjected> {
    this._injection = injection;
    return this as unknown as MiddlewareHandlersRegistryEntry<TApiDef, TDIContainer, TPathParams, TPath, TNewInjected>;
  }

  register<const TMiddlewareSchemas extends MiddlewareHandlerSchemas>(
    middlewareSchemas: TMiddlewareSchemas,
    handler: MiddlewareHandler<`${TPathParams}${ExtractConcatenatedParamNamesFromPath<TPath>}`, TMiddlewareSchemas, TInjected>
  ) {
    const internalEntry = new MiddlewareHandlersRegistryEntryInternal<TDIContainer, TInjected>(
      this._registry.dicontainer,
      this._path,
      middlewareSchemas,
      this._injection,
      handler as unknown as MiddlewareHandlerInternal<TInjected>
    );
    this._registry.register(internalEntry);
  }
}

export type OnMiddlewareHandlerRegisteredCallback<
  TDIContainer extends DIContainer,
  TInjected
> = (entry: MiddlewareHandlersRegistryEntryInternal<TDIContainer, TInjected>) => void;

export class MiddlewareHandlersRegistry<
  TDIContainer extends DIContainer
> {
  public readonly dicontainer: TDIContainer;

  constructor(
    dicontainer: TDIContainer,
    callback: OnMiddlewareHandlerRegisteredCallback<TDIContainer, unknown>
  ) {
    this.dicontainer = dicontainer;
    this._onHandlerRegisteredCallback = callback;
  }

  private readonly _list: MiddlewareHandlersRegistryEntryInternal<TDIContainer, unknown>[] = [];
  public get list(): Readonly<MiddlewareHandlersRegistryEntryInternal<TDIContainer, unknown>[]> {
    return this._list;
  }

  register<TInjected>(entry: MiddlewareHandlersRegistryEntryInternal<TDIContainer, TInjected>) {
    if (this._onHandlerRegisteredCallback) {
      this._list.push(entry as MiddlewareHandlersRegistryEntryInternal<TDIContainer, unknown>);
      this._onHandlerRegisteredCallback(entry);
    }
  }

  private _onHandlerRegisteredCallback: OnMiddlewareHandlerRegisteredCallback<TDIContainer, any> | null = null;
  _onHandlerRegistered(callback: OnMiddlewareHandlerRegisteredCallback<TDIContainer, unknown>): void {
    this._onHandlerRegisteredCallback = callback;
  }
}

function middlewareParseRequestDefinitionField<
  T extends Record<string, any>
>(
  middlewareSchemas: MiddlewareHandlerSchemas,
  key: 'headers' | 'query' | 'body',
  requestObject: T
): any {
  if (middlewareSchemas[key]) {
    if (
      !(key in requestObject)
      || requestObject[key as keyof T] === null
      || requestObject[key as keyof T] === undefined
    ) {
      // middlewareSchemas[key].isOptional was deprecated in favour of safeParse with success check
      const result = middlewareSchemas[key].safeParse(requestObject[key as keyof T]);
      if (!result.success) {
        // since frameworks are not consistent in sending null vs undefined for missing request object parts, 
        // we handle both cases here, so that
        // we handle missing parts of the request object according to how the schema defines them
        switch (middlewareSchemas[key].type) {
          case 'optional':
            if (requestObject[key] === null) {
              return undefined;
            }
            break;
          case 'nullable':
            if (requestObject[key] === undefined) {
              return null;
            }
            break;
        }
        return { 
          code: HttpStatusCode.BadRequest_400, 
          body: `'${key}' is required for this endpoint` + (
            key === 'body' ? ", { 'Content-Type': 'application/json' } header might be missing" : ''
          )
        };
      }
      return result.data;
    }
    const result = middlewareSchemas[key].safeParse(requestObject[key as keyof T]);
    if (!result.success) {
      return { 
        code: HttpStatusCode.BadRequest_400, 
        body: result.error.issues
      };
    }
    return result.data;
  }
  return null; // by design, if request object parts are not defined through schema, we set them to null
}