import { treeifyError, z } from "zod";
import { IHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpMethodEndpointHandlerOutput } from "./http_method_endpoint_handler_output.js";
import { FailedValidationSections } from "./failed_validation_sections.js";

// 1) Helper: “If T[P] is a Zod schema, produce { [P]: z.input<…> }, else {}”
type InferInputProp<
  T extends IHttpMethodEndpointDefinition,
  P extends keyof T
> = T[P] extends z.ZodType<any, any>
  ? Record<P, z.input<T[P]>>
  : {};

// 2) Merge three of them:
type Merge3<A, B, C> = A & B & C;

// 3) Build the input, then test “did we get any props at all?”
export type HttpMethodCallInput<
  T extends IHttpMethodEndpointDefinition
> = Merge3<
    InferInputProp<T, "headers">,
    InferInputProp<T, "query">,
    InferInputProp<T, "body">
  > extends infer M                      // infer the merged object
    ? keyof M extends never              // if it has no keys…
      ? never                            // → you declared nothing
      : M                                // otherwise → that’s your input
    : never;                             // this is just a type guard to ensure M is inferred correctly

export enum RequestFailureCode {
  ErrorThrown = -1,
  SchemaValidationFailed = -2,
}

export type RequestFailureErrorThrownOutput = {
  code: RequestFailureCode.ErrorThrown;
  body: Error;
}

export type RequestFailureSchemaValidationFailedOutput<TEndpointDefinition extends IHttpMethodEndpointDefinition> = {
  code: RequestFailureCode.SchemaValidationFailed;
  headers: {
    "x-failed-validation-sections": FailedValidationSections<TEndpointDefinition>;
  };
  body: ReturnType<typeof treeifyError<Exclude<TEndpointDefinition['headers'] | TEndpointDefinition['query'] | TEndpointDefinition['body'], undefined>>>;
}

export function isRequestFailureSchemaValidationFailedOutput<TEndpointDefinition extends IHttpMethodEndpointDefinition>(output: any): output is RequestFailureSchemaValidationFailedOutput<TEndpointDefinition> {
  return typeof output === 'object' 
    && output !== null 
    && 'code' in output 
    && output.code === RequestFailureCode.SchemaValidationFailed;
}

export type HttpMethodCallFunc<TEndpointDefinition extends IHttpMethodEndpointDefinition> = 
  HttpMethodCallInput<TEndpointDefinition> extends never
    ? () => Promise<
      | HttpMethodEndpointHandlerOutput<TEndpointDefinition>
      | RequestFailureErrorThrownOutput
    >
    : (input: HttpMethodCallInput<TEndpointDefinition>) => Promise<
      | HttpMethodEndpointHandlerOutput<TEndpointDefinition>
      | RequestFailureErrorThrownOutput
      | RequestFailureSchemaValidationFailedOutput<TEndpointDefinition>
    >;