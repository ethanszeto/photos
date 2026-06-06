import { BottomNav } from "@/features/navigation/components/BottomNav";
import { UploadProvider } from "@/features/upload/components/UploadProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <BottomNav />
    </UploadProvider>
  );
}
