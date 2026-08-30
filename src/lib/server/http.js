/**
 * The shape every route handler shares: typed errors, JSON replies, and
 * validation that reports the same way FastAPI did so the client is unchanged.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const notFound = (what) => new ApiError(404, `${what} not found`);
export function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
  });
}
export const noContent = () =>
  new NextResponse(null, {
    status: 204,
  });

/**
 * Wrap a handler so a thrown ApiError becomes its status and anything else
 * becomes a 500 without leaking the stack to the client.
 */
export function route(handler) {
  return async (request, ...rest) => {
    try {
      return await handler(request, ...rest);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            detail: error.message,
          },
          {
            status: error.status,
          },
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            detail: describe(error),
          },
          {
            status: 422,
          },
        );
      }
      console.error("Unhandled error in route handler:", error);
      return NextResponse.json(
        {
          detail: "Something went wrong",
        },
        {
          status: 500,
        },
      );
    }
  };
}
function describe(error) {
  const first = error.issues[0];
  if (!first) return "That request was not valid";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}

/** Parse a JSON body against a schema, rejecting malformed JSON as 422 too. */
export async function body(request, schema) {
  let raw;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(422, "Expected a JSON body");
  }
  return schema.parse(raw);
}

/** Postgres uuid columns reject anything else, so check the shape before querying. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => UUID.test(value);
