# Shared Admin Routes

This directory contains admin functionality that spans both Mahad and Dugsi programs.

## Structure

- `attendance/` - Attendance tracking for both programs (note: currently not working, needs fix)
- `payments/` - Payment management across both programs (moved to root `/admin/payments`)
- `subscriptions/` - Subscription linking for both programs (moved to root `/admin/link-subscriptions`)
- `profit-share/` - Financial calculations across programs (moved to root `/admin/profit-share`)

## Notes

- All routes require admin authentication
- Routes may need program filters to show data for both programs
- Attendance feature needs to be fixed (noted for later)
