export enum HttpStatusCode {
  Continue_100 = 100,
  SwitchingProtocols_101 = 101,
  OK_200 = 200,
  Created_201 = 201,
  Accepted_202 = 202,
  NoContent_204 = 204,
  MultipleChoices_300 = 300,
  MovedPermanently_301 = 301,
  Found_302 = 302,
  SeeOther_303 = 303,
  NotModified_304 = 304,
  BadRequest_400 = 400,
  Unauthorized_401 = 401,
  Forbidden_403 = 403,
  NotFound_404 = 404,
  Conflict_409 = 409,
  UnprocessableEntity_422 = 422,
  InternalServerError_500 = 500,
  NotImplemented_501 = 501,
  BadGateway_502 = 502,
  ServiceUnavailable_503 = 503,
  GatewayTimeout_504 = 504,
}

export function isHttpStatusCode(value: any): value is HttpStatusCode {
  return value in HttpStatusCode; // works only if HttpStatusCode is NOT a const enum
}