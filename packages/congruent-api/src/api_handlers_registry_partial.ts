import { IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry } from "./api_handlers_registry.js";
import { MethodEndpointHandlerRegistryEntry } from "./api_handlers_registry_entry.js";
import { PartialPath } from "./api_routing_partial.js";
import { DIContainer } from "./di_container_2.js";
import { ExtractConcatenatedParamNamesFromPathSegments } from "./typed_path_params.js";

export function partial<
  TDIContainer extends DIContainer,
  TApiDef extends IApiContractDefinition & ValidateApiContractDefinition<TApiDef>,
  TPathParams extends string,
  const TPath extends PartialPath<TApiDef>
>(
  apiReg: ApiHandlersRegistry<TApiDef, TDIContainer, TPathParams>,
  path: TPath
): PartialPathResult<TApiDef, TPath> extends infer TPartialApi
  ? TPartialApi extends IApiContractDefinition & ValidateApiContractDefinition<TPartialApi>
    ? ApiHandlersRegistry<TPartialApi, TDIContainer, ExtractConcatenatedParamNamesFromPathSegments<TPath>>
    : never
  : never {
  const pathSegments = (path as string).split('/').filter((segment: string) => segment.length > 0);
  let current: any = apiReg;
  for (const segment of pathSegments) {
    if (current[segment] instanceof MethodEndpointHandlerRegistryEntry) {
      throw new Error(`Path "${path}" is not partial`);
    } else if (typeof current[segment] === 'object') {
      current = current[segment];
    } else {
      throw new Error(`Path segment "${segment}" not found in API handlers registry`);
    }
  }
  return current as any;
}

export type PartialPathResult<
  TApiDef extends IApiContractDefinition,
  TPath extends string
> = TPath extends `/${infer Rest}`
  ? NavigateToPartialPath<TApiDef, SplitPath<Rest>>
  : NavigateToPartialPath<TApiDef, SplitPath<TPath>>;

type SplitPath<TPath extends string> = TPath extends `${infer First}/${infer Rest}`
  ? [First, ...SplitPath<Rest>]
  : TPath extends ""
    ? []
    : [TPath];

type NavigateToPartialPath<TDef, TSegments extends readonly string[]> = TSegments extends readonly [
  infer First extends string,
  ...infer Rest extends readonly string[]
]
  ? First extends keyof TDef
    ? Rest extends readonly []
      ? TDef[First] extends object
        ? TDef[First]
        : never
      : NavigateToPartialPath<TDef[First], Rest>
    : never
  : TDef;