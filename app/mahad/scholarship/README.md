# Scholarship Application Feature

Secure, server-first scholarship application system with PDF generation and email delivery.

## Architecture

### Server Actions

- **submitScholarshipApplication** (`_actions/index.tsx`)
  - Validates form data server-side
  - Generates PDF on server
  - Sends email to admin with PDF attachment
  - Sends confirmation email to student
  - Returns success/error result

### Components

- **page.tsx** - Server component entry point with metadata
- **scholarship-form.tsx** - Client component for multi-step form (326 lines)
- **submission-success.tsx** - Success confirmation screen
- **steps/** - Individual form step components (4 steps)
- **pdf/scholarship-pdf-document.tsx** - PDF template (server-rendered)

### Data Flow

```
User fills form → Client validation → Submit
                                        ↓
                            Server Action (server-side)
                                        ↓
                    Validate with Zod → Generate PDF → Send Emails
                                        ↓
                            Success/Error response
```

## Setup

### Required Environment Variables

```bash
RESEND_API_KEY="re_..."           # Get from resend.com
EMAIL_FROM="Mahad <noreply@...>"  # Your sender email
ADMIN_EMAIL="admin@..."            # Where applications are sent
REPLY_TO_EMAIL="support@..."       # Optional reply-to address
```

### Email Service (Reusable)

The email service at `/lib/email/` is designed to be reused across the entire application:

```typescript
import { sendEmail, sendAdminEmailWithPDF } from '@/lib/email/email-service'

// For scholarship applications
await sendAdminEmailWithPDF({
  subject: 'Scholarship Application',
  studentName: '...',
  studentEmail: '...',
  pdfBuffer: buffer,
  pdfFilename: 'application.pdf',
})

// For student registration (future use)
await sendEmail({
  to: 'student@email.com',
  subject: 'Registration Confirmation',
  html: '<p>Welcome!</p>',
})
```

## Testing

1. **Local Testing:**

   ```bash
   # Add Resend API key to .env.local
   npm run dev
   # Navigate to /mahad/scholarship-application
   # Fill and submit form
   # Check email inbox
   ```

2. **Test Mode:**
   - Use Resend test mode API key for development
   - Emails will be captured in Resend dashboard, not delivered

## Features

✅ Multi-step form with validation
✅ Server-side PDF generation
✅ Email to admin with PDF attachment
✅ Confirmation email to student
✅ Proper error handling
✅ Loading states
✅ Type-safe end-to-end
✅ 12.7 KB bundle size (97.5% reduction from 503 KB)

## Known Limitations

- No draft saving (data lost on refresh) - To be implemented
- No application tracking IDs - To be implemented
- No database persistence - To be implemented
- Client-side validation only per step (full validation on submit)

## Future Enhancements

- Add localStorage persistence
- Add application tracking IDs
- Store applications in database
- Add admin dashboard for reviewing applications
- Add status tracking and notifications
- Implement student search/selection feature
