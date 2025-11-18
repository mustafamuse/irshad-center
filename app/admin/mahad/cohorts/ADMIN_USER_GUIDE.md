# Mahad Cohorts - Admin User Guide

## Overview

The Mahad Cohorts admin interface provides comprehensive student and batch management for the Islamic college program. The interface uses **parallel routes** for optimal performance - each section loads independently.

---

## Main Interface Sections

When you visit `/admin/mahad/cohorts`, you'll see 4 independent sections:

### 1. Duplicate Detection (Top)

- Automatically detects students with matching phone numbers
- Shows groups of potential duplicates
- Appears only when duplicates are found

### 2. Batch Management (Middle)

- Grid of all cohorts
- Create new batches
- View student counts
- Assign students to batches

### 3. Students Table (Bottom)

- Filterable, paginated table of all students
- Search and advanced filtering
- Inline editing
- Bulk operations

### 4. Student Detail Modal (Overlay)

- Click any student row to open modal
- View/edit full student details
- Organized into sections

---

## Student Management

### Searching & Filtering

**Search Bar:**

- Searches across: Name, Email, Phone
- Real-time as you type
- Updates URL (sharable link)

**Filters:**

- **Batch**: Filter by cohort assignment (including unassigned)
- **Status**: registered, enrolled, withdrawn, etc.
- **Subscription**: active, past_due, canceled
- **Education Level**: high school, some college, bachelors, etc.
- **Grade Level**: specific grade or year

**Pagination:**

- 50 students per page (default)
- Navigate with Previous/Next buttons
- URL updates with page number

### Inline Editing

Click on any field in the table to edit:

**Editable Fields:**

- Name
- Email
- Phone
- Date of Birth
- Education Level
- Grade Level
- School Name
- Monthly Rate
- Batch Assignment

**Auto-Save:**

- Changes save automatically
- Green checkmark indicates success
- Red error if validation fails

**Validation:**

- Email must be unique
- Phone must be unique
- Names auto-capitalize
- Dates must be valid

### Viewing Student Details

**Two Ways to View:**

1. **Modal View** (Quick Look):
   - Click student row
   - Opens overlay modal
   - URL updates: `/admin/mahad/cohorts/students/[id]`
   - Press ESC or click X to close
   - Back button returns to list

2. **Full Page View** (Deep Dive):
   - Right-click row → "Open in new tab"
   - Or refresh while modal is open
   - Full page with back button
   - URL: `/admin/mahad/cohorts/students/[id]`

**Modal Sections:**

1. **Basic Information**
   - Name, Email, Phone
   - Date of Birth
   - Status

2. **Batch & Payment**
   - Current batch assignment
   - Monthly rate (custom or default $150)
   - Subscription status

3. **Education Information**
   - Education level
   - Grade level
   - School name
   - Graduation years

4. **Siblings**
   - Linked family members
   - Sibling group info

### Bulk Operations

**Selecting Students:**

- Click checkboxes to select individual students
- Click header checkbox to select all visible students
- Selection persists while filtering (clears on navigation)

**Bulk Actions:**

1. **Assign to Batch**:
   - Select students
   - Click "Assign Students" button
   - Choose target batch
   - Confirm assignment

2. **Delete Students**:
   - Select students
   - Click "Delete" button
   - Warning if student has siblings
   - Warning if student has attendance records
   - Confirm deletion

---

## Batch Management

### Creating a Batch

1. Click **"Create Cohort"** button
2. Enter batch name (e.g., "Irshad 4S", "Fall 2024")
3. Click **"Create"**
4. Batch appears in grid

**Naming Conventions:**

- Use descriptive names
- Include semester/year if applicable
- Must be unique

### Viewing Batch Details

Each batch card shows:

- **Name**: Batch/cohort name
- **Student Count**: Active students (excludes withdrawn)
- **Date Range**: Start/end dates (if set)

### Assigning Students to Batch

**Method 1: Bulk Assignment**

1. Select multiple students from table
2. Click "Assign Students"
3. Choose target batch from dropdown
4. Click "Assign"
5. Students move to new batch

**Method 2: Individual Assignment**

1. Click student row to open modal
2. Edit Batch field
3. Select new batch
4. Click "Save"

**Method 3: Inline Edit**

1. Click batch cell in table
2. Select from dropdown
3. Auto-saves

### Deleting a Batch

1. Click batch card
2. Click "Delete" button (if visible)
3. Confirm deletion

**Safety:**

- Can't delete batch with students
- Must first unassign all students
- Or delete all students in batch

---

## Duplicate Detection

### How It Works

**Detection:**

- Automatically scans all students
- Matches by phone number
- Normalizes phone (removes formatting)
- Requires minimum 7 digits

**When It Appears:**

- Only shown if duplicates found
- Appears at top of page
- Shows "Show" button to expand/collapse

### Resolving Duplicates

1. **Review Group**:
   - See all students with matching phone
   - Review name, email, batch, status
   - Identify which to keep

2. **Choose Resolution**:
   - Click "Resolve Duplicates"
   - Select which student to KEEP
   - Select which students to DELETE
   - Option: Merge data (fills nulls in keep record)

3. **Confirm Merge**:
   - Review changes
   - Click "Merge & Delete"
   - Duplicates removed
   - Keep record updated (if merge enabled)

**Best Practices:**

- Keep oldest record (usually original)
- Check for attendance records before deleting
- Check for sibling groups
- Merge data to preserve information

---

## URL-Based Filtering

### Sharable Filter States

All filters are stored in the URL, making them:

- **Sharable**: Send link to colleague with filters applied
- **Bookmarkable**: Save frequently-used filter combinations
- **Persistent**: Refresh page keeps filters
- **Back-button friendly**: Browser back/forward works

**Example URLs:**

```
# Show all enrolled students in Irshad 4S
/admin/mahad/cohorts?status=enrolled&batch=batch-123

# Search for "Ahmed" with active subscriptions
/admin/mahad/cohorts?search=Ahmed&subscriptionStatus=active

# Page 2 with 100 students per page
/admin/mahad/cohorts?page=2&limit=100
```

### Clearing Filters

- Click **"Clear Filters"** button
- Or manually edit URL
- Or navigate to `/admin/mahad/cohorts` (no params)

---

## Performance Features

### Independent Loading

**Each section loads separately:**

- Duplicate detection loads first (fastest query)
- Batch grid loads independently
- Students table loads with filters applied
- If one section errors, others still work

**Benefits:**

- See batch data while students are still loading
- Error in duplicates doesn't crash students table
- Better perceived performance

### Loading States

**Visual Feedback:**

- Skeleton loaders for each section
- Section-specific skeletons (match actual content)
- Screen reader announcements

### Error Handling

**Isolated Error Boundaries:**

- Error in students table → shows error, batches still work
- Error in duplicates → shows error, students still work
- Error in batches → shows error, students still work

**Error Display:**

- Red alert box with error message
- "Try Again" button to retry
- Error ID for debugging (production)

---

## Keyboard Shortcuts

**Table Navigation:**

- `Tab`: Move between fields
- `Enter`: Edit selected field
- `Esc`: Cancel edit / Close modal

**Modal:**

- `Esc`: Close modal, return to list

---

## Common Workflows

### Workflow 1: Enroll New Students

1. Students register via `/mahad/register`
2. Appear in students table with status "registered"
3. Admin assigns to batch
4. Admin updates status to "enrolled"
5. Students receive enrollment confirmation (if implemented)

### Workflow 2: Create New Cohort

1. Click "Create Cohort"
2. Enter name (e.g., "Spring 2025")
3. Filter students table: status=registered
4. Select unassigned students
5. Click "Assign Students"
6. Choose new cohort
7. Assign students

### Workflow 3: Handle Withdrawals

1. Find student in table
2. Click to open modal
3. Change status to "withdrawn"
4. Save changes
5. Student excluded from batch counts
6. Subscription status unchanged (manual cancellation in Stripe if needed)

### Workflow 4: Clean Up Duplicates

1. Duplicate detection shows at top
2. Click "Show" to expand
3. Review each duplicate group
4. Click "Resolve Duplicates"
5. Select student to keep
6. Enable "Merge data" if you want to preserve info
7. Click "Merge & Delete"
8. Duplicates removed

### Workflow 5: Transfer Students Between Batches

1. Filter to show source batch students
2. Select students to transfer
3. Click "Assign Students"
4. Choose destination batch
5. Confirm transfer
6. Students move to new batch
7. Student counts update automatically

---

## Tips & Best Practices

### Search Tips

- **Name search**: Partial matches work ("Ahmed" finds "Ahmed Ali")
- **Email search**: Type full or partial email
- **Phone search**: Last 4 digits works, or full number
- **Combine filters**: Search + batch filter + status filter

### Batch Tips

- Use consistent naming (e.g., "Irshad 4S", "Irshad 1")
- Don't delete batches - keep for historical records
- Create batches before assigning students

### Duplicate Prevention

- Enforce unique email during registration
- Enforce unique phone during registration
- Run duplicate detection weekly
- Review before enrolling new cohorts

### Data Integrity

- Don't delete students with attendance records (creates orphans)
- Check sibling groups before deleting
- Use "withdrawn" status instead of delete when possible
- Keep historical data for reporting

---

## Troubleshooting

### "Failed to Load Students Table"

**Causes:**

- Database connection issue
- Query timeout (too many results)
- Invalid filter parameters

**Solutions:**

- Click "Try Again"
- Clear filters
- Reduce page size (use limit=25)
- Check database connection

### "Cannot delete batch with assigned students"

**Cause:** Batch has students

**Solutions:**

- Unassign all students first (assign to null)
- Or delete all students in batch
- Or keep batch for historical records

### Modal Doesn't Open

**Causes:**

- JavaScript error
- Intercepting route not working

**Solutions:**

- Refresh page
- Check browser console for errors
- Use full page view (right-click → open in new tab)

### Filters Not Working

**Causes:**

- Invalid enum value in URL
- Too many filter values (capped at 20)

**Solutions:**

- Click "Clear Filters"
- Remove invalid parameters from URL
- Reduce number of selected filters

---

## Data Export (Future Feature)

**Note:** Export functionality exists in code but no UI button yet.

**To implement:**

- Add "Export" button
- Calls `exportStudentsAction()`
- Downloads CSV file

---

## Accessibility Features

**Screen Reader Support:**

- All buttons have labels
- Form fields have labels
- Error messages announced
- Loading states announced
- Modals have proper ARIA attributes

**Keyboard Navigation:**

- Tab through all interactive elements
- Enter to activate buttons
- Esc to close modals/cancel edits

---

## Getting Help

**If you encounter issues:**

1. Check browser console for errors
2. Try "Try Again" button
3. Clear filters
4. Refresh page
5. Check database connection
6. Review error ID (if shown)

**For feature requests:**

- Document the use case
- Describe expected behavior
- Note current workarounds

---

**Last Updated**: 2025-11-17
**Interface Version**: Parallel Routes v1.0
