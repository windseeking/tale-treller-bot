export type AppRequest<Body = unknown, Params extends Record<string, unknown> = Record<string, unknown>> = {
  token?: string;
  params?: Params;
  body?: Body;
};
