import { DIScope } from "./di_container.js";
import { HttpRequestObject } from "./http_method_endpoint_handler_input.js";

export interface ICanTriggerAsync {
  triggerNoStaticTypeCheck(
    diScope: DIScope<any>,
    requestObject: HttpRequestObject,
    context: any
  ): Promise<any>;

  get genericPath(): string;
}