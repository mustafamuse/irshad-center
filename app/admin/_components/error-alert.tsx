interface ErrorAlertProps {
  message: string | undefined | null
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 p-3"
    >
      <p className="text-sm text-red-800">{message}</p>
    </div>
  )
}
