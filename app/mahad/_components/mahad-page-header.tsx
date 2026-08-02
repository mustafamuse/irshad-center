interface MahadPageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  headerExtra?: React.ReactNode
}

export function MahadPageHeader({
  title,
  description,
  headerExtra,
}: MahadPageHeaderProps) {
  return (
    <header className="mb-10 space-y-3 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mx-auto max-w-md text-base text-gray-500">
          {description}
        </p>
      ) : null}
      {headerExtra}
    </header>
  )
}
