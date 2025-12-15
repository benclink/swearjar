import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold">Family Finances</h1>
        <p className="text-muted-foreground">
          Track spending, manage budgets, and get AI-powered insights for your household finances.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline">Sign Up</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
