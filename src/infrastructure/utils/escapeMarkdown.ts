export default (value: string): string => {
    if (!value) return ''
    return value
        .replaceAll('\\', '\\\\')
        .replaceAll('_', '\\_')
        .replaceAll('*', '\\*')
        .replaceAll('`', '\\`')
        .replaceAll('[', '\\[')
}