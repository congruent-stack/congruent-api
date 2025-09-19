import { DIScope } from "./di_container_2.js";

export interface ICanTriggerAsync {
  trigger(
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