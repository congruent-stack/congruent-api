import { z } from "zod";
import { IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry } from "./api_handlers_registry.js";
import { DIContainer, DIScope } from "./di_container.js";
import { HttpMethodEndpoint } from "./http_method_endpoint.js";
import { ExtractConcatenatedParamNamesFromPath, TypedPathParams } from "./typed_path_params.js";
import { HttpMethod } from "./http_method_type.js";
import { HttpStatusCode } from "./http_status_code.js";
import { HttpResponseObject, isHttpResponseObject } from "./http_method_endpoint_handler_output.js";

export type MiddlewareHandlerInputSchemas = {
  headers?: z.ZodType,
  query?: z.ZodType,
  body?: z.ZodType
};

export type MiddlewareHandlerInput<
  TPathParams extends string,
  InputSchemas extends MiddlewareHandlerInputSchemas,
  TInjected
> = {
  method: HttpMethod;
  pathSegments: readonly string[];
  path: string;
  genericPath: string;
  headers: InputSchemas['headers'] extends z.ZodType ? z.output<InputSchemas['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
  pathParams: TypedPathParams<TPathParams>;
  query: InputSchemas['query'] extends z.ZodType ? z.output<InputSchemas['query']> : null; // z.output because the handler receives the parsed input
  body: InputSchemas['body'] extends z.ZodType ? z.output<InputSchemas['body']> : null; // z.output because the handler receives the parsed input
  injected: Readonly<TInjected>;
};

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
  InputSchemas extends MiddlewareHandlerInputSchemas,
  TInjected
> = (
  input: MiddlewareHandlerInput<TPathParams, InputSchemas, TInjected>,
  next: () => void
) => Promise<HttpResponseObject | void>;

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
> {
  
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

  private readonly _inputSchemas: MiddlewareHandlerInputSchemas;

  private readonly _handler: MiddlewareHandlerInternal<TInjected>;

  constructor(
    diContainer: TDIContainer,
    middlewarePath: string,
    inputSchemas: MiddlewareHandlerInputSchemas,
    injection: (dicontainer: TDIContainer) => TInjected,
    handler: MiddlewareHandlerInternal<TInjected>
  ) {
    this._dicontainer = diContainer;
    this._middlewareGenericPath = middlewarePath;
    this._inputSchemas = inputSchemas;
    this._injection = injection;
    this._handler = handler;
  }

  private _injection: any = (_dicontainer: TDIContainer) => ({});

  async trigger(
    diScope: DIScope<any>,
    data: { 
      headers: Record<string, string>,
      pathParams: Record<string, string>,
      query: object,
      body: object,
    }, 
    next: () => void
  ): Promise<any> {
    let badRequestResponse: HttpResponseObject | null = null;
    
    const headers = middlewareParseRequestDefinitionField(this._inputSchemas, 'headers', data);
    if (isHttpResponseObject(headers)) {
      badRequestResponse = headers;
      return badRequestResponse;
    }

    const query = middlewareParseRequestDefinitionField(this._inputSchemas, 'query', data);
    if (isHttpResponseObject(query)) {
      badRequestResponse = query;
      return badRequestResponse;
    }

    const body = middlewareParseRequestDefinitionField(this._inputSchemas, 'body', data);
    if (isHttpResponseObject(body)) {
      badRequestResponse = body;
      return badRequestResponse;
    }

    const { method, pathSegments } = this._splitMiddlewarePath();

    const path = `/${pathSegments.map(segment =>
      segment.startsWith(':')
        ? (data.pathParams[segment.slice(1)] ?? '?')
        : segment
    ).join('/')}`;

    return await this._handler(
      { 
        method: method as HttpMethod, // TODO: might be empty, as middleware can be registered with path only, without method, possible fix: take it from express.request.method
        path,
        genericPath: this.genericPath,
        pathSegments: pathSegments,
        headers,
        pathParams: data.pathParams as any, 
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

  private _injection: any = (_dicontainer: TDIContainer) => ({});
  public get injection(): any {
    return this._injection;
  }

  inject<TNewInjected>(injection: (dicontainer: TDIContainer) => TNewInjected): MiddlewareHandlersRegistryEntry<TApiDef, TDIContainer, TPathParams, TPath, TNewInjected> {
    this._injection = injection;
    return this as unknown as MiddlewareHandlersRegistryEntry<TApiDef, TDIContainer, TPathParams, TPath, TNewInjected>;
  }

  register<const InputSchemas extends MiddlewareHandlerInputSchemas>(
    inputSchemas: InputSchemas,
    handler: MiddlewareHandler<`${TPathParams}${ExtractConcatenatedParamNamesFromPath<TPath>}`, InputSchemas, TInjected>
  ) {
    const internalEntry = new MiddlewareHandlersRegistryEntryInternal<TDIContainer, TInjected>(
      this._registry.dicontainer,
      this._path,
      inputSchemas,
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
  inputSchemas: MiddlewareHandlerInputSchemas,
  key: 'headers' | 'query' | 'body',
  data: T
): any {
  if (inputSchemas[key]) {
    if (
      !(key in data)
      || data[key as keyof T] === null
      || data[key as keyof T] === undefined
    ) {
      // inputSchemas[key].isOptional was deprecated in favour of safeParse with success check
      if (!inputSchemas[key].safeParse(data[key as keyof T]).success) {
        return { 
          code: HttpStatusCode.BadRequest_400, 
          body: `'${key}' is required for this endpoint` + (
            key === 'body' ? ", { 'Content-Type': 'application/json' } header might be missing" : ''
          )
        };
      }
      return null;
    }
    const result = inputSchemas[key].safeParse(data[key as keyof T]);
    if (!result.success) {
      return { 
        code: HttpStatusCode.BadRequest_400, 
        body: result.error.issues
      };
    }
    return result.data ?? null;
  }
  return null;
}