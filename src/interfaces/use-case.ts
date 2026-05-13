export interface UseCase<Input, Output> {
  call(input: Input): Output | Promise<Output>;
}
