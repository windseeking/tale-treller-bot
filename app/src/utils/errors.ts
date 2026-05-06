import { appT } from '../i18n'

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : appT('unknownError')
}
