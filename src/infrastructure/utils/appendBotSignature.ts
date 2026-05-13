import {env} from '#config/env.js'

export default (desc: string): string => {
    const username = env.TELEGRAM_BOT_USERNAME
    const url = env.TELEGRAM_BOT_URL
    const signature = `Task created with [@${username}](${url}).`
    const trimmed = desc.trimEnd()

    if (trimmed.endsWith(signature)) {
        return trimmed
    }

    return `${trimmed}\n\n${signature}`
}