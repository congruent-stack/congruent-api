import { z } from "zod";
import { IHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpMethodEndpointHandlerOutput } from "./http_method_endpoint_handler_output.js";

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

export type HttpMethodCallFunc<T extends IHttpMethodEndpointDefinition> = 
  HttpMethodCallInput<T> extends never
    ? () => Promise<HttpMethodEndpointHandlerOutput<T>>
    : (input: HttpMethodCallInput<T>) => Promise<HttpMethodEndpointHandlerOutput<T>>;