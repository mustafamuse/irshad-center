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
   bun install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Fill in the required environment variables.

4. Set up the database:

   ```bash
   bunx prisma migrate dev
   bunx prisma generate
   ```

5. Start the development server:
   ```bash
   bun run dev
   ```

### Development Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Fix linting issues
- `bun run format:write` - Format code with Prettier
- `bun run typecheck` - Run TypeScript type checking
- `bun run cleanup` - Run format, lint, and type check

## Project Structure

```
irshad-center/
├── app/                    # Next.js App Router pages
│   ├── mahad/             # Public Mahad program pages
│   ├── dugsi/             # Public Dugsi program pages
│   ├── admin/             # Admin routes
│   │   ├── mahad/         # Mahad admin
│   │   │   └── cohorts/   # Cohort management
│   │   ├── dugsi/         # Dugsi admin
│   │   └── shared/        # Shared admin features
│   │       └── attendance/ # Attendance tracking
│   └── api/               # API routes
│       └── webhook/       # Stripe webhooks
├── components/            # Shared components
│   ├── ui/               # Shadcn UI components
│   └── layout/           # Layout components
├── lib/                   # Utilities and configurations
│   ├── db/               # Database utilities
│   ├── utils/            # Helper functions
│   └── validations/      # Zod schemas
├── prisma/               # Database schema and migrations
├── docs/                 # Documentation
│   ├── ARCHITECTURE.md   # Architecture overview
│   ├── ROUTING.md        # Routing structure
│   └── COMPONENT_PATTERNS.md # Component patterns
└── public/               # Static assets
```

## Architecture

This application follows Next.js 15 best practices with a **domain-driven routing structure**:

- **Server Components** by default for optimal performance
- **Server Actions** for data mutations and form handling
- **TypeScript** for type safety
- **Zustand** for UI-only state management
- **Feature-based component organization**
- **Centralized types and utilities**

### Domain-Driven Routing

Routes are organized by program/domain:

- `/mahad` - Public Mahad program pages
- `/dugsi` - Public Dugsi program pages
- `/admin/mahad` - Mahad admin functionality
- `/admin/dugsi` - Dugsi admin functionality
- `/admin/shared` - Shared admin features

### Documentation

For detailed architecture information, see:

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Architecture overview, principles, and patterns
- **[ROUTING.md](docs/ROUTING.md)** - Route structure and organization
- **[COMPONENT_PATTERNS.md](docs/COMPONENT_PATTERNS.md)** - Component patterns and best practices

## Key Features

### Program Management

- **Mahad Program** - College-level Islamic education
  - Public registration flow
  - Cohort management
  - Student tracking

- **Dugsi Program** - K-12 Islamic education (ages 5 to teens)
  - Parent-led registration
  - Family grouping and management
  - Payment status tracking

### Shared Features

- **Attendance Tracking** - Cross-program attendance management
- **Payment Management** - Stripe integration for subscriptions
- **Subscription Linking** - Manual subscription management
- **Financial Reporting** - Profit share calculations

## Contributing

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our architecture patterns

3. Ensure your code is properly typed and formatted

4. Run checks:

   ```bash
   bun run lint:fix
   bun run format:write
   bun run typecheck
   bun run build
   ```

5. Create a pull request

## License

This project is proprietary and confidential.

## Support

For support, contact the development team at [email@example.com](mailto:email@example.com).
