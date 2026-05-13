export interface TrelloAuthSecrets {
  generateOpaqueSecret(): string;
  hashSecret(secret: string): string;
  isSecretHashMatch(params: { secret: string; hash: string }): boolean;
  encryptString(value: string): string;
  decryptString(value: string): string;
}
