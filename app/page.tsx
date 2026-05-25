import { redirect } from "next/navigation";
import { PasscodeLock } from "@/components/passcode/PasscodeLock";
import { isAuthenticatedServer } from "@/lib/session";

type HomePageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const authenticated = await isAuthenticatedServer();

  if (authenticated) {
    redirect(params.from?.startsWith("/gallery") ? params.from : "/gallery");
  }

  const redirectTo = params.from?.startsWith("/gallery") ? params.from : "/gallery";

  return <PasscodeLock redirectTo={redirectTo} />;
}
