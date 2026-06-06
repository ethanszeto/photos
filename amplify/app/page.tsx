import { redirect } from "next/navigation";
import { PasscodeLock } from "@/features/auth/components/PasscodeLock";
import { isAuthenticatedServer } from "@/lib/session";

type HomePageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const authenticated = await isAuthenticatedServer();

  const appPaths = ["/photos", "/albums", "/gallery"];
  const fromPath = params.from;
  const isAppPath = fromPath != null && appPaths.some((prefix) => fromPath.startsWith(prefix));
  const resolvedFrom = fromPath?.startsWith("/gallery") ? "/photos" : fromPath;

  if (authenticated) {
    redirect(isAppPath && resolvedFrom ? resolvedFrom : "/photos");
  }

  const redirectTo = isAppPath && resolvedFrom ? resolvedFrom : "/photos";

  return <PasscodeLock redirectTo={redirectTo} />;
}
