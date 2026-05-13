import type { BotSessionState, DestinationTarget, SessionStorePort } from '#interfaces/bot.js'

export type BotSession = BotSessionState;

export class SessionStore implements SessionStorePort {
  private readonly sessions = new Map<number, BotSession>()

  public get(chatId: number): BotSession {
    const existing = this.sessions.get(chatId)
    if (existing) {
      return existing
    }

    const created = this.createEmptySession()
    this.sessions.set(chatId, created)
    return created
  }

  public resetTask(chatId: number): BotSession {
    const existing = this.sessions.get(chatId)
    if (!existing) {
      const created = this.createEmptySession()
      this.sessions.set(chatId, created)
      return created
    }

    existing.stage = 'collecting'
    existing.messages = []
    existing.draftText = undefined
    existing.destinationId = undefined
    existing.selectionStep = undefined
    existing.selectedTarget = undefined
    existing.destinationState = {}

    return existing
  }

  public hasLastSelection(session: BotSession): boolean {
    return Boolean(session.lastTarget)
  }

  public clearSelectionFlow(session: BotSession): void {
    session.stage = 'collecting'
    session.destinationId = undefined
    session.selectionStep = undefined
    session.selectedTarget = undefined
    session.destinationState = {}
  }

  public startDestinationFlow(session: BotSession, params: {
    destinationId: string;
    selectionStep?: string;
    state?: Record<string, unknown>;
  }): void {
    session.stage = 'destination_flow'
    session.destinationId = params.destinationId
    session.selectionStep = params.selectionStep
    session.selectedTarget = undefined
    session.destinationState = params.state ?? {}
  }

  public setSelectionStep(session: BotSession, selectionStep: string): void {
    session.stage = 'destination_flow'
    session.selectionStep = selectionStep
  }

  public setSelectedTarget(session: BotSession, target: DestinationTarget): void {
    session.selectedTarget = target
  }

  public useLastSelection(session: BotSession): void {
    session.selectedTarget = session.lastTarget
  }

  public completeTaskAndRememberSelection(session: BotSession): void {
    session.lastTarget = session.selectedTarget

    session.stage = 'collecting'
    session.messages = []
    session.draftText = undefined
    session.destinationId = undefined
    session.selectionStep = undefined
    session.selectedTarget = undefined
    session.destinationState = {}
  }

  private createEmptySession(): BotSession {
    return {
      stage: 'collecting',
      messages: [],
      destinationState: {}
    }
  }
}
