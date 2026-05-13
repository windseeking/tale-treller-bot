import type { BotAction, TaskDestinationHandler, TaskDestinationRegistry } from '#interfaces/bot.js'

export class InMemoryTaskDestinationRegistry implements TaskDestinationRegistry {
  private readonly destinationsById = new Map<string, TaskDestinationHandler>()

  public constructor(
    destinations: TaskDestinationHandler[],
    private readonly defaultDestinationId: string
  ) {
    for (const destination of destinations) {
      this.destinationsById.set(destination.id, destination)
    }
  }

  public getDefault(): TaskDestinationHandler {
    const destination = this.findById(this.defaultDestinationId)
    if (!destination) {
      throw new Error(`Default task destination is not registered: ${this.defaultDestinationId}`)
    }

    return destination
  }

  public findById(destinationId: string): TaskDestinationHandler | null {
    return this.destinationsById.get(destinationId) ?? null
  }

  public findByAction(action: BotAction): TaskDestinationHandler | null {
    for (const destination of this.destinationsById.values()) {
      if (destination.ownsAction(action)) {
        return destination
      }
    }

    return null
  }

  public findByCallbackData(data: string): TaskDestinationHandler | null {
    for (const destination of this.destinationsById.values()) {
      if (destination.ownsCallbackData(data)) {
        return destination
      }
    }

    return null
  }
}
