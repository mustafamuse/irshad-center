# Weekend Attendance Feature

This document describes the newly implemented attendance feature for weekend study sessions in the Mahad App.

## Overview

The attendance feature allows administrators to:
- Create weekend study sessions
- Mark attendance for students with multiple status options
- Track attendance statistics and reports
- Filter and manage attendance records

## Features Implemented

### 1. Database Schema Updates
- Updated `AttendanceStatus` enum to include:
  - `PRESENT` - Student attended the session
  - `ABSENT` - Student was absent (general absence)
  - `UNEXCUSED_ABSENT` - Student was absent without valid excuse
  - `LATE` - Student arrived late to the session
  - `EXCUSED` - Student was absent but with valid excuse

### 2. API Endpoints

#### Attendance Management
- `GET /api/admin/attendance` - Fetch weekend sessions with filters
- `GET /api/admin/attendance?action=stats` - Get attendance statistics
- `GET /api/admin/attendance/[sessionId]` - Get specific session details
- `POST /api/admin/attendance/mark` - Mark attendance (single or bulk)
- `POST /api/admin/attendance/sessions` - Create new weekend session

#### Schedules
- `GET /api/admin/schedules?weekendsOnly=true` - Get weekend class schedules

### 3. User Interface Components

#### Admin Dashboard (`/admin/attendance`)
- **Attendance Stats Cards**: Display key metrics
  - Weekend Sessions count
  - Completed Sessions count
  - Active Students count
  - Average Attendance Rate
  
- **Session Management**: List of weekend sessions with:
  - Session details (subject, batch, date, time)
  - Attendance status (Complete, Partial, Pending)
  - Quick access to mark attendance

- **Create Session Dialog**: Form to create new weekend sessions
  - Select class schedule
  - Pick session date
  - Set start/end times
  - Add optional notes

#### Attendance Marking Interface
- **Student List**: Shows all students in the batch
- **Status Selection**: Easy-to-use buttons for each attendance status
- **Bulk Actions**: Mark all students with same status
- **Notes Field**: Optional notes for each student's attendance
- **Real-time Updates**: Immediate feedback on attendance marking

### 4. Weekend Filtering
- Sessions are automatically filtered to show only weekend classes
- Schedules with `SATURDAY` or `SUNDAY` in `daysOfWeek` are considered weekend sessions
- API endpoints support `weekendsOnly` parameter for filtering

## Technical Implementation

### Type Definitions
```typescript
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  UNEXCUSED_ABSENT = 'UNEXCUSED_ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export interface AttendanceSession {
  id: string
  date: Date
  startTime: Date
  endTime: Date
  schedule: {
    subject: { name: string }
    batch: { name: string, students: Student[] }
  }
  attendance: AttendanceRecord[]
  studentsCount: number
  attendanceMarked: number
  isComplete: boolean
}
```

### Database Queries
The feature uses optimized Prisma queries with:
- Proper indexing for performance
- Nested includes for related data
- Filtering capabilities for weekend sessions
- Upsert operations for attendance records

### UI Components
Built with:
- **Shadcn UI** components for consistent design
- **Radix UI** primitives for accessibility
- **Tailwind CSS** for responsive styling
- **React Hook Form** for form management
- **Sonner** for toast notifications

## Usage Instructions

### For Administrators

1. **Access Attendance Dashboard**
   - Navigate to `/admin/attendance`
   - View attendance statistics and session overview

2. **Create Weekend Session**
   - Click "Create Session" button
   - Select a class schedule that includes weekend days
   - Choose session date (future dates only)
   - Set start and end times
   - Add optional notes
   - Submit to create session

3. **Mark Attendance**
   - Find the session in the list
   - Click "Mark Attendance" or "View Attendance"
   - For each student, select appropriate status:
     - **Present**: Student attended normally
     - **Absent**: Student was absent
     - **Unexcused Absent**: Student was absent without valid reason
     - **Late**: Student arrived late
     - **Excused**: Student was absent with valid excuse
   - Add notes if needed
   - Use bulk actions to mark multiple students with same status
   - Save attendance records

4. **View Statistics**
   - Dashboard shows key metrics
   - Track completion rates
   - Monitor attendance trends

### Bulk Operations
- **Mark All Present**: Quickly mark all students as present
- **Mark All Absent**: Mark all students as absent
- **Mark All Unexcused**: Mark all students as unexcused absent

### Data Validation
- All API endpoints include Zod schema validation
- Form inputs are validated client-side
- Proper error handling with user-friendly messages

## Navigation Integration

The attendance feature is integrated into the admin navigation:
- Desktop: Top navigation bar with "Attendance" link
- Mobile: Hamburger menu with attendance option
- Consistent with existing admin interface design

## Future Enhancements

Potential improvements that could be added:
1. **Attendance Reports**: Generate PDF reports for attendance
2. **Email Notifications**: Notify parents of attendance status
3. **Attendance History**: View historical attendance patterns
4. **Analytics Dashboard**: Advanced attendance analytics
5. **Mobile App**: Native mobile app for quick attendance marking
6. **Barcode/QR Scanning**: Quick student check-in system

## File Structure

```
app/
├── admin/attendance/
│   ├── page.tsx                          # Main attendance page
│   └── components/
│       ├── attendance-management.tsx     # Session list and management
│       ├── attendance-dialog.tsx         # Attendance marking interface
│       ├── attendance-stats.tsx          # Statistics cards
│       └── create-session-dialog.tsx     # Session creation form
├── api/admin/
│   ├── attendance/
│   │   ├── route.ts                      # Main attendance API
│   │   ├── [sessionId]/route.ts          # Session details API
│   │   ├── mark/route.ts                 # Mark attendance API
│   │   └── sessions/route.ts             # Create session API
│   └── schedules/route.ts                # Schedules API
lib/
├── types/attendance.ts                   # TypeScript type definitions
└── queries/attendance.ts                 # Database query functions
```

## Testing

The feature has been tested with:
- TypeScript compilation checks
- Database schema validation  
- API endpoint functionality
- UI component rendering
- Sample data creation and manipulation

## Deployment Notes

1. **Database Migration**: The schema changes have been applied
2. **Environment Variables**: No additional environment variables required
3. **Dependencies**: All required dependencies are already installed
4. **Build Process**: Feature builds successfully with the main application

---

## Summary

The Weekend Attendance Feature is now fully implemented and ready for use. It provides a comprehensive solution for managing attendance in weekend study sessions with an intuitive interface, robust API, and proper data validation. The feature follows the app's existing patterns and design system for consistency.