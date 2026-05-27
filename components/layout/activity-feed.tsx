import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/activity";

type ActivityFeedProps = {
  items: ActivityItem[];
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <section className="mt-12 animate-fade-up">
      <h2 className="font-display text-[1.375rem] font-semibold text-ink">
        What to work on today
      </h2>
      <p className="mt-1 text-sm text-ink-secondary">
        Suggested next steps across your career prep tools.
      </p>
      <ul className="mt-5 space-y-3">
        {items.map((item, index) => (
          <li key={item.id}>
            <Card
              interactive
              className="animate-fade-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Link href={item.href} className="block">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                  {item.label}
                </p>
                <p className="mt-1 text-[0.9375rem] text-ink">{item.detail}</p>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
