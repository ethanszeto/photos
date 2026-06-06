"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, LayoutGrid, Plus } from "lucide-react";
import { useUpload } from "@/components/upload/UploadProvider";

type NavTab = {
  id: "photos" | "albums" | "upload";
  label: string;
  href?: string;
  icon: React.ReactNode;
};

const TABS: NavTab[] = [
  { id: "photos", label: "Photos", href: "/photos", icon: <LayoutGrid className="h-6 w-6" aria-hidden /> },
  { id: "albums", label: "Albums", href: "/albums", icon: <Folder className="h-6 w-6" aria-hidden /> },
  { id: "upload", label: "Upload", icon: <Plus className="h-6 w-6" aria-hidden /> },
];

function isPhotosActive(pathname: string): boolean {
  return pathname === "/photos" || pathname.startsWith("/photos/");
}

function isAlbumsActive(pathname: string): boolean {
  return pathname === "/albums" || pathname.startsWith("/albums/");
}

export function BottomNav() {
  const pathname = usePathname();
  const { openUpload } = useUpload();

  return (
    <nav
      className="shrink-0 border-t border-white/10 bg-black/80 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active =
            tab.id === "photos" ? isPhotosActive(pathname) : tab.id === "albums" ? isAlbumsActive(pathname) : false;

          if (tab.id === "upload") {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={openUpload}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-white/50 transition-colors active:text-white/70"
                aria-label="Upload photos"
              >
                {tab.icon}
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href!}
              className={[
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-white" : "text-white/50 active:text-white/70",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              {tab.icon}
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
