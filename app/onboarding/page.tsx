import { OnboardingClient } from "./onboarding-client";

// Server component: reads searchParams and passes as props to the client component.
// This avoids needing useSearchParams() (which requires a Suspense boundary).
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  return <OnboardingClient editId={edit} />;
}
