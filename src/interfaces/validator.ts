export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationResult<T> = {
  data: T;
  errors: ValidationIssue[];
};

export interface Validator<T> {
  validate(data: Partial<T>): ValidationResult<T>;
}
