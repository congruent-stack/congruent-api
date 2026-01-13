import { apiContract, endpoint, HttpStatusCode, response, zodErrorTreeSchema } from "@congruent-stack/congruent-api";
import z from "zod";

export const CommonHeadersSchema = z.object({
  mySecret: z.uuid("Must be a valid GUID"),
});

export const UnauthorizedResponseBodySchema = z.object({
  userMessage: z.string(),
});

export const contract = apiContract({
    // POST /somepath/:myparam
    somepath: {
      [':myparam']: {
        POST: endpoint({
          headers: CommonHeadersSchema,
          body: z.object({
            age: z.number()
                  .int()
                  .min(0, "Age must be a positive number")
                  .max(150, "Age must be less than or equal to 150"),
          }),
          responses: {
            [HttpStatusCode.OK_200]: response({ 
              body: z.string() 
            }),
            [HttpStatusCode.Forbidden_403]: response({ 
              body: UnauthorizedResponseBodySchema 
            }),
            [HttpStatusCode.BadRequest_400]: response({ 
              body: zodErrorTreeSchema
            })
          }
        })
      }
    }
  });