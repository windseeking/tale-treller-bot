import type { TrelloAuthSecrets } from '#interfaces/trello/auth/trello-auth-secrets.js'
import {
  decryptString,
  encryptString,
  generateOpaqueSecret,
  hashSecret,
  isSecretHashMatch
} from './crypto.js'

export class CryptoTrelloAuthSecrets implements TrelloAuthSecrets {
  public generateOpaqueSecret(): string {
    return generateOpaqueSecret()
  }

  public hashSecret(secret: string): string {
    return hashSecret(secret)
  }

  public isSecretHashMatch(params: { secret: string; hash: string }): boolean {
    return isSecretHashMatch(params)
  }

  public encryptString(value: string): string {
    return encryptString(value)
  }

  public decryptString(value: string): string {
    return decryptString(value)
  }
}
