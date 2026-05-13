import type { UseCase } from '#interfaces/use-case.js'

const MIN_TEXT_LENGTH = 15

export type ValidateDraftInput = {
  messages: string[];
};

export type ValidateDraftResult =
  | { ok: true; currentLength: number; draftText: string }
  | { ok: false; reason: 'empty' | 'too_short'; currentLength: number };

export class ValidateDraft implements UseCase<ValidateDraftInput, ValidateDraftResult> {
  public call(input: ValidateDraftInput): ValidateDraftResult {
    const text = input.messages
        .map((value) => value.trim())
        .filter(Boolean)
        .join('\n\n')

    const validation = { ok: text.length >= MIN_TEXT_LENGTH, currentLength: text.length }

    if (text.length === 0) {
      return { ok: false, reason: 'empty', currentLength: validation.currentLength }
    }

    if (!validation.ok) {
      return { ok: false, reason: 'too_short', currentLength: validation.currentLength }
    }

    return { ok: true, currentLength: validation.currentLength, draftText: text }
  }
}
