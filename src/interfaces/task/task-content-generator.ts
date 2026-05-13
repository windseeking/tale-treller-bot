export interface TaskContentGenerator<TInput, TGenerated> {
  generate(input: TInput): Promise<TGenerated>;
}
