/**
 * Extracts typed path parameters from a path string.
 * For example, given a path string like ":p1:p2:...:pn", it will return an object type with properties for each parameter.
 * 
 * @template TPathParams - The path parameters string, e.g., ":id:name:age".
 * @returns An object type with properties for each parameter.
 * 
 * @example
 * ```
 * const typedParams: TypedPathParams<':id:name'> = {
 *   id: '1',
 *   name: 'Bulbasaur'
 * };
 * console.log(typedParams.id);   // "1"
 * console.log(typedParams.name); // "Bulbasaur"
 * ```
 */
export type TypedPathParams<TPathParams extends string> = 
  TPathParams extends `:${infer ParamName}:${infer RestParams}`
    ? { [K in ParamName]: string } & TypedPathParams<`:${RestParams}`>
    : TPathParams extends `:${infer ParamName}`
      ? { [K in ParamName]: string }
      : {};

export type ExtractConcatenatedParamNamesFromMethodFirstPath<TPath extends string> = 
  TPath extends `${string} ${infer PathPart}` // "METHOD /path"
    ? ExtractConcatenatedParamNamesFromPathSegments<PathPart>
    : never;

export type ExtractConcatenatedParamNamesFromPathSegments<TPath extends string> = 
  TPath extends `/${infer Segment}/${infer Rest}` // "/segment/rest"
    ? Segment extends `:${infer ParamName}`
      ? `:${ParamName}${ExtractConcatenatedParamNamesFromPathSegments<`/${Rest}`> extends `:${infer RestParams}` ? `:${RestParams}` : ""}`
      : ExtractConcatenatedParamNamesFromPathSegments<`/${Rest}`>
    : TPath extends `/${infer Segment}`
      ? Segment extends `:${infer ParamName}`
        ? `:${ParamName}`
        : ""
    : "";

export type ExtractConcatenatedParamNamesFromPath<TPath extends string> =
  TPath extends `${string} ${string}` // "METHOD /path"
    ? ExtractConcatenatedParamNamesFromMethodFirstPath<TPath>
    : TPath extends `/${string}` // "/path"
      ? ExtractConcatenatedParamNamesFromPathSegments<TPath>
      : never;
