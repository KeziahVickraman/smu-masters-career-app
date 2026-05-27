import { ActivityFeed } from "@/components/layout/activity-feed";
import { FeatureCard } from "@/components/layout/feature-card";
import { HowToUse } from "@/components/layout/how-to-use";
import { SiteHeader } from "@/components/layout/site-header";
import { APP_FEATURES } from "@/lib/features";
import { TODAY_ACTIVITY } from "@/lib/activity";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <div className="app-shell">
        <main>
          <section className="content-narrow animate-fade-up">
            <h1 className="font-display text-[3rem] italic leading-[1.1] text-primary whitespace-nowrap">
              The career tool that actually respects your intelligence.
            </h1>
            <p className="mt-4 text-[0.9375rem] leading-7 text-ink-secondary">
            The job market doesn't wait. Neither should your prep. Built for SMU Masters by SMU Masters students.
            </p>
          </section>

          {/* How to use — collapsible, sits right below the hero */}
          <div className="mt-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
            <HowToUse />
          </div>

          <section className="mt-12 grid gap-5 md:grid-cols-3">
            {APP_FEATURES.map((feature, index) => (
              <FeatureCard
                key={feature.slug}
                feature={feature}
                style={{ animationDelay: `${index * 50}ms` }}
              />
            ))}
          </section>

          <ActivityFeed items={TODAY_ACTIVITY} />
        </main>
      </div>
    </>
  );
}
