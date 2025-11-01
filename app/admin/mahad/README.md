# Mahad Admin Routes

This directory contains admin functionality specific to the Mahad (college-level) program.

## Structure

- `cohorts/` - Cohort management (groups of students starting together)
- `students/` - Student management for Mahad program

## Notes

- All routes require admin authentication
- Routes are Mahad-specific and filter by `program: 'MAHAD_PROGRAM'`
