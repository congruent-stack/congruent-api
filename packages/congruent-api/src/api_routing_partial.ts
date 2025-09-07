import { IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { ApiHandlersRegistry } from "./api_handlers_registry.js";
import { HttpMethodEndpoint } from "./http_method_endpoint.js";

export function partialPathString<
  TApiDef extends IApiContractDefinition & ValidateApiContractDefinition<TApiDef>,
  TPathParams extends string,
  const TPath extends PartialPath<TApiDef>
>(
  _apiReg: ApiHandlersRegistry<TApiDef, any, TPathParams>,
  path: TPath
): string {
  return path as string;
}

export type PartialPath<TDef, BasePath extends string = ""> =
  | (BasePath extends "" ? "" : never)
  | {
      [K in keyof TDef & string]:
        TDef[K] extends HttpMethodEndpoint<infer _TEndpointDef>
          ? never
          : TDef[K] extends object
            ? `${BasePath}/${K}` | PartialPath<TDef[K], `${BasePath}/${K}`>
            : never
    }[keyof TDef & string];