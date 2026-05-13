export default (value: string): boolean => {
    try {
        new Intl.DateTimeFormat('en-US', {timeZone: value}).format(new Date())
        return true
    } catch {
        return false
    }
}