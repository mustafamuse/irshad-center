# Irshad Center App

A modern Next.js application for managing student attendance, payments, and administrative tasks at Irshad Center.

## Features

- 📊 Weekend Attendance Tracking
- 💳 Payment Management
- 📱 Responsive Design
- 🔒 Role-based Access Control
- 🎨 Modern UI with Shadcn/UI
- 🚀 Performance Optimized

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn/UI](https://ui.shadcn.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Data Fetching**: Server Components + [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- **Database**: [Prisma](https://www.prisma.io/) with PostgreSQL
- **Payments**: [Stripe](https://stripe.com/)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Stripe Account

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/irshad-center.git
   cd irshad-center
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Fill in the required environment variables.

4. Set up the database:

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues
- `npm run format:write` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking
- `npm run cleanup` - Run format, lint, and type check

## Project Structure

```
irshad-center/
├── app/                    # Next.js App Router pages
│   ├── (features)/        # Feature-based routes
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # Shared components
│   ├── ui/               # UI components
│   └── layout/           # Layout components
├── lib/                   # Utilities and configurations
│   ├── actions/          # Server actions
│   ├── config/           # App configuration
│   └── utils/            # Helper functions
├── prisma/               # Database schema and migrations
└── public/               # Static assets
```

## Architecture

This application follows Next.js 15 best practices:

- **Server Components** by default for optimal performance
- **Server Actions** for data mutations and form handling
- **TypeScript** for type safety
- **Functional components** with React hooks
- **Tailwind CSS** for styling
- **Mobile-first responsive design**

### Component Structure

```typescript
// Server Component (default)
interface ComponentProps {
  required: string
  optional?: number
}

export default function ServerComponent({ required, optional }: ComponentProps) {
  // Direct database access
  const data = await prisma.model.findMany()

  return (
    <div>
      {/* Server-side rendered content */}
    </div>
  )
}

// Client Component (when needed)
'use client'

export function ClientComponent({ data }: { data: any[] }) {
  // 1. Client-side hooks
  const [state, setState] = useState()

  // 2. Event handlers
  const handleClick = useCallback(...)

  // 3. Render
  return (...)
}
```

## Key Features

### Weekend Attendance System

- Mobile-responsive attendance marking
- Server Actions for data mutations
- Real-time attendance tracking
- Batch and session management

### Payment Management

- Stripe integration for subscriptions
- Manual payment recording
- Payment history tracking
- Student billing management

## Contributing

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our architecture patterns

3. Ensure your code is properly typed and formatted

4. Run checks:

   ```bash
   npm run lint:fix
   npm run format:write
   npm run typecheck
   npm run build
   ```

5. Create a pull request

## License

This project is proprietary and confidential.

## Support

For support, contact the development team at [email@example.com](mailto:email@example.com).
