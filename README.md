# Family Finances Dashboard

A personal finance dashboard with an embedded AI-powered chat assistant. Built with Next.js, Supabase, and Claude.

## Features

- **Dashboard Overview**: Visual breakdown of Essential vs Discretionary spending
- **Transaction Management**: View, filter, and categorize all transactions
- **AI Chat Assistant**: Natural language queries about your finances
- **CSV Import**: Upload Ubank and PayPal transaction files
- **Budget Tracking**: Set and monitor monthly budgets by category
- **Reports**: Monthly summaries, subscription audits, spending trends

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Database**: Supabase Postgres with Row Level Security
- **Auth**: Supabase Auth
- **AI**: Vercel AI SDK + Claude (claude-sonnet-4-20250514)
- **Charts**: Recharts
- **Hosting**: Vercel

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/finances-dashboard.git
cd finances-dashboard
npm install
```

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready

### 3. Set Up the Database

1. Open the Supabase SQL Editor
2. Copy the contents of `supabase/schema.sql`
3. Run the SQL to create tables, views, and RLS policies

### 4. Configure Environment Variables

Create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

Fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

You can find your Supabase keys in: Project Settings → API

### 5. Create User Accounts

1. Go to Supabase Dashboard → Authentication → Users
2. Create accounts for yourself and your wife
3. Note down the user IDs for the migration step

### 6. Migrate Existing Data (Optional)

If you have existing transaction data in SQLite:

```bash
# Install tsx for running TypeScript
npm install -D tsx better-sqlite3 @types/better-sqlite3

# Run the migration
SUPABASE_URL=your_url \
SUPABASE_SERVICE_ROLE_KEY=your_key \
SQLITE_PATH=../Finances/Data/transactions.db \
USER_ID=your_user_id \
npx tsx scripts/migrate-sqlite-to-supabase.ts
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/finances-dashboard.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and import your repository
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
3. Deploy!

### 3. Configure Supabase Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

- Add your Vercel URL to "Site URL"
- Add `https://your-app.vercel.app/api/auth/callback` to "Redirect URLs"

## Using the Chat Assistant

The AI assistant can help with:

**Queries:**
- "How much did I spend on groceries last month?"
- "Show me all Bunnings purchases"
- "What are my recurring subscriptions?"
- "Am I on track with my budget?"

**Actions:**
- "Categorize transaction XYZ as Dining Out"
- "Learn: Coffee Club should be Dining Out"
- "Set a $500 budget for Dining Out"

**Reports:**
- "Generate a summary for November 2025"
- "Compare this month vs last month"

## Project Structure

```
/src
  /app
    /(auth)           # Login/signup pages
    /(dashboard)      # Main app pages
    /api
      /chat           # Claude agent endpoint
      /auth           # Auth callback
  /components
    /ui               # shadcn/ui components
    /chat             # Chat panel components
    /dashboard        # Dashboard components
    /charts           # Recharts components
    /transactions     # Transaction components
  /lib
    /supabase         # Supabase client setup
    /agent            # Claude tool definitions
    /utils.ts         # Helper functions
```

## Spending Categories

**Essential:**
Groceries, Utilities, Insurance, Healthcare, Transport, Mortgage, Loans, Pets, Kids

**Discretionary:**
Dining Out, Alcohol, Entertainment, Clothing, Gifts, Subscriptions, Shopping, Home & Garden

## License

Private - for personal use only.
