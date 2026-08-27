# realistic-app

A realistic Node.js application built with Next.js, Prisma, and PostgreSQL.

## Prerequisites

- Node.js 22 or later
- PostgreSQL 16
- Redis 7

## Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run db:migrate` - Run Prisma migrations
- `npm run db:seed` - Seed the database

## Docker

```bash
# Build and run with Docker Compose
docker compose up --build

# Run in background
docker compose up -d
```

The app will be available at http://localhost:3000

## Architecture

- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Validation**: Zod
- **Testing**: Jest

## License

MIT
