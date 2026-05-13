export interface TaskCreator<TPayload, TContext, TResult> {
  create(payload: TPayload, context: TContext): Promise<TResult>;
}
