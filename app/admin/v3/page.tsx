import { DataTable } from "@/components/data-table"
import data from "../v2/data.json"

export default function AdminV3Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <h1 className="text-2xl font-bold mb-4">V3 Dashboard - Original DataTable with Status Badges</h1>
          </div>
          <DataTable data={data} />
        </div>
      </div>
    </div>
  )
}