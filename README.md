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

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn/UI](https://ui.shadcn.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query)
- **Database**: [Prisma](https://www.prisma.io/) with PostgreSQL
- **Testing**: [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
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
- `npm run lint:fix` - Fix linting issues
- `npm run format:write` - Format code
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

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

## Code Style

We follow strict coding conventions enforced by ESLint and Prettier:

- TypeScript for type safety
- Functional components with hooks
- Server Components by default
- Tailwind CSS for styling
- Component documentation with JSDoc
- Comprehensive testing

### Component Structure

```typescript
/**
 * Component description
 */
interface ComponentProps {
  required: string
  optional?: number
}

export function Component({ required, optional }: ComponentProps) {
  // 1. Hooks
  const data = useQuery(...)

  // 2. Derived state
  const computed = useMemo(...)

  // 3. Handlers
  const handleClick = useCallback(...)

  // 4. Render
  return (...)
}
```

## Testing

We use Vitest and React Testing Library for testing:

- Unit tests for utilities and hooks
- Integration tests for components
- E2E tests for critical flows
- High test coverage requirement

### Example Test

```typescript
describe('Component', () => {
  it('renders correctly', () => {
    render(<Component required="test" />)
    expect(screen.getByText('test')).toBeInTheDocument()
  })
})
```

## Contributing

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our code style

3. Write tests for your changes

4. Run checks:

   ```bash
   npm run lint:fix
   npm run format:write
   npm run test
   ```

5. Create a pull request

## License

This project is proprietary and confidential.

## Support

For support, contact the development team at [email@example.com](mailto:email@example.com).
