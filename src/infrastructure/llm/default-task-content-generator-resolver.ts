import type { TaskContentGeneratorResolver, TaskContentGeneratorResolverInput } from '#interfaces/task/task-content-generator-resolver.js'
import type { TaskGenerator } from '#interfaces/task/task-generator.js'

export class DefaultTaskContentGeneratorResolver implements TaskContentGeneratorResolver {
  public constructor(private readonly defaultGenerator: TaskGenerator) {}

  public async resolve(_input: TaskContentGeneratorResolverInput): Promise<TaskGenerator> {
    return this.defaultGenerator
  }
}
