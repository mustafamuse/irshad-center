# Mahad Admin

Admin dashboard for the Mahad (college-level) program.

## Structure

```
app/admin/mahad/
├── page.tsx           # Main dashboard page
├── _actions/          # Server actions
├── _hooks/            # React hooks
├── _lib/              # Utilities
├── _types/            # Type definitions
├── _utils/            # Helper functions
├── components/        # UI components
├── constants/         # Form options, etc.
└── store/             # Zustand state management
```

## Notes

- All routes require admin authentication
- Routes are Mahad-specific and filter by `program: 'MAHAD_PROGRAM'`
