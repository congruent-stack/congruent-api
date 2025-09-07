import { IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry } from "./api_handlers_registry.js";
import { MethodEndpointHandlerRegistryEntry } from "./api_handlers_registry_entry.js";
import { ExtractEndpointFromPath, MethodFirstPath, route } from "./api_routing.js";
import { DIContainer } from "./di_container.js";
import { IHttpMethodEndpointDefinition, ValidateHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpMethodEndpointHandler } from "./http_method_endpoint_handler.js";
import { ExtractConcatenatedParamNamesFromMethodFirstPath } from "./typed_path_params.js";

// Overload for registerMethodPathHandler
export function register<
  const TApiDef extends IApiContractDefinition & ValidateApiContractDefinition<TApiDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string,
  const TPath extends MethodFirstPath<TApiDef>
>(
  apiReg: ApiHandlersRegistry<TApiDef, TDIContainer, TPathParams>,
  path: TPath,
  handler: HttpMethodEndpointHandler<ExtractEndpointFromPath<TApiDef, TPath>, `${TPathParams}${ExtractConcatenatedParamNamesFromMethodFirstPath<TPath>}`, {}>
): void;

// Overload for registerEntryHandler
export function register<
  const TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string
>(
  endpointEntry: MethodEndpointHandlerRegistryEntry<TDef, TDIContainer, TPathParams>,
  handler: HttpMethodEndpointHandler<TDef, TPathParams, {}>
): void;

// Implementation
export function register<
  const TApiDef extends IApiContractDefinition & ValidateApiContractDefinition<TApiDef>,
  TDIContainer extends DIContainer,
  const TPath extends MethodFirstPath<TApiDef>,
  const TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  TPathParams extends string
>(
  apiRegOrEndpoint: ApiHandlersRegistry<TApiDef, TDIContainer, TPathParams> | MethodEndpointHandlerRegistryEntry<TDef, TDIContainer, TPathParams>,
  pathOrHandler: TPath | HttpMethodEndpointHandler<TDef, TPathParams, {}>,
  handler?: HttpMethodEndpointHandler<ExtractEndpointFromPath<TApiDef, TPath>, ExtractConcatenatedParamNamesFromMethodFirstPath<TPath>, {}>
): void {
  if (arguments.length === 3 && handler !== undefined) {
    registerMethodPathHandler(
      apiRegOrEndpoint as any,
      pathOrHandler as any,
      handler
    );
  } else if (arguments.length === 2) {
    registerEntryHandler(
      apiRegOrEndpoint as any,
      pathOrHandler as any
    );
  } else {
    throw new Error('Invalid number of arguments provided to register function');
  }
}

function registerMethodPathHandler<
  const TApiDef extends IApiContractDefinition & ValidateApiContractDefinition<TApiDef>,
  TPathParams extends string,
  const TPath extends MethodFirstPath<TApiDef>
>(
  apiReg: ApiHandlersRegistry<TApiDef, any, any>,
  path: TPath,
  handler: HttpMethodEndpointHandler<ExtractEndpointFromPath<TApiDef, TPath>, `${TPathParams}${ExtractConcatenatedParamNamesFromMethodFirstPath<TPath>}`, any>
) {
  const endpointEntry = route(apiReg, path);
  return registerEntryHandler(endpointEntry, handler);
}

function registerEntryHandler<
  const TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string
>(
  endpointEntry: MethodEndpointHandlerRegistryEntry<TDef, TDIContainer, TPathParams>,
  handler: HttpMethodEndpointHandler<TDef, TPathParams, any>
) {
  endpointEntry.register(handler);
}
  