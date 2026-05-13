import type { TaskGenerator } from './task-generator.js'

export type TaskContentGeneratorResolverInput = {
  telegramUserId: number;
  destinationId: string;
};

export interface TaskContentGeneratorResolver {
  resolve(input: TaskContentGeneratorResolverInput): Promise<TaskGenerator>;
}
