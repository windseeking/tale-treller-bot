export type GeneratedTaskInput = {
    text: string;
    currentDate: string;
};

export type GeneratedTaskOutput = {
    name: string;
    desc: string;
    due?: string;
    urlSource?: string;
};

export interface TaskGenerator {
  generateTask(params: GeneratedTaskInput): Promise<GeneratedTaskOutput>;
}
