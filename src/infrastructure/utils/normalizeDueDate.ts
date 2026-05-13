export default (value: unknown): unknown => {
    if (typeof value !== 'string') {
        return value
    }

    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed}T23:59:00.000Z`
    }

    return trimmed
}