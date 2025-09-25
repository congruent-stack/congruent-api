import { DIScope } from "./di_container.js";

export interface ICanTriggerAsync {
  triggerNoStaticTypeCheck(
    diScope: DIScope<any>,
    requestObject: { 
      headers: Record<string, string>,
      pathParams: Record<string, string>,
      query: object,
      body: object,
    },
    next?: () => Promise<void>
  ): Promise<any>;

  get genericPath(): string;
}