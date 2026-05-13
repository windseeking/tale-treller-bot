export interface TaskContextProvider<TInput, TContext> {
  resolve(input: TInput): Promise<TContext>;
}
