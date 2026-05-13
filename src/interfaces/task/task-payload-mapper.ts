export interface TaskPayloadMapper<TInput, TGenerated, TContext, TPayload> {
  map(params: {
    input: TInput;
    generated: TGenerated;
    context: TContext;
  }): TPayload;
}
