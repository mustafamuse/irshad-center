import { getMultiRolePeopleAction } from '../actions'
import { MultiRolePeopleList } from './components/multi-role-people-list'

export default async function MultiRolePeoplePage() {
  const result = await getMultiRolePeopleAction()

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Multi-Role People</h1>
          <p className="text-muted-foreground">
            People with multiple roles across the system
          </p>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {result.error ?? 'Failed to load data'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Role People</h1>
        <p className="text-muted-foreground">
          People with multiple roles across the system (Teachers, Students,
          Parents)
        </p>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Total Multi-Role People</p>
            <p className="text-2xl font-bold">{result.data.length}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            People with 2 or more roles (Teacher, Student, Parent)
          </div>
        </div>
      </div>

      <MultiRolePeopleList people={result.data} />
    </div>
  )
}
