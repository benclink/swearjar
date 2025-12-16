import { Sidebar } from "@/components/dashboard/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <ChatPanel />
    </div>
  );
}
