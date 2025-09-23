# Simple Attendance Feature Plan

## Current Structure

```
attendance/
├── components/      # UI components
└── page.tsx        # Main page
```

## 1. Server Components (No API needed)

```tsx
// page.tsx - Server Component
async function AttendancePage() {
  // Direct Prisma calls
  const batches = await prisma.batch.findMany()

  return (
    <div>
      <AttendanceForm batches={batches} />
    </div>
  )
}
```

## 2. Client Components

```tsx
// components/AttendanceForm.tsx - Client Component
'use client'

function AttendanceForm({ batches }) {
  const [selectedBatch, setSelectedBatch] = useState('')
  // ...
}
```

## 3. Server Actions (Instead of API)

```tsx
// actions.ts
'use server'

export async function markAttendance(data: FormData) {
  const batchId = data.get('batchId')
  const date = data.get('date')

  await prisma.attendance.create({
    data: {
      batchId,
      date,
      // ...
    },
  })
}
```

## 4. Database (Prisma)

```prisma
model Attendance {
  id        String   @id @default(uuid())
  date      DateTime
  studentId String
  batchId   String
  status    String   // present, absent, late
  createdAt DateTime @default(now())
  student   Student  @relation(fields: [studentId], references: [id])
  batch     Batch    @relation(fields: [batchId], references: [id])
}
```

## Components to Create

1. AttendanceForm (Client)
   - Batch selection
   - Date picker
   - Student list

2. AttendanceList (Server)
   - Show attendance history
   - Filter by date/batch

## Basic Features

- [ ] Select batch and date
- [ ] Mark attendance for students
- [ ] View attendance history
- [ ] Simple search and filter

## Simple Success Criteria

- [ ] Data saves correctly in database
- [ ] UI is responsive
- [ ] Basic error handling
- [ ] Works without page refresh

## Next Steps

1. Create server components with direct Prisma calls
2. Add client components for interactivity
3. Implement server actions for forms
4. Add basic error handling

Keep it simple:

- Use Server Components where possible
- Only use Client Components for interactivity
- Direct Prisma calls instead of API routes
- Server Actions for forms
