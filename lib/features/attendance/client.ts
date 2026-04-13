export class AttendanceFetchError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'AttendanceFetchError'
  }
}

export async function attendanceFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new AttendanceFetchError(
      res.status,
      body.error ?? `Request failed: ${res.status}`
    )
  }
  return res.json() as Promise<T>
}
