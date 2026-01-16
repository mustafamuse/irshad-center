export async function copyToClipboard(
  text: string,
  onSuccess?: () => void,
  onError?: (err: unknown) => void
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    onSuccess?.()
    return true
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    onError?.(err)
    return false
  }
}
