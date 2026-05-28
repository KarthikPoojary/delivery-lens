import { Suspense } from 'react';
import RepoPicker from '@/components/RepoPicker';
import MetricsDashboard from '@/components/MetricsDashboard';
import { SkeletonDashboard } from '@/components/SkeletonCard';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;
  const currentRepo = typeof repo === 'string' ? repo : '';

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">Delivery Lens</h1>
          <p className="text-sm text-neutral-500">
            DORA-aligned engineering health metrics for any public GitHub repository
          </p>
        </header>

        <RepoPicker currentRepo={currentRepo} />

        {currentRepo ? (
          <Suspense key={currentRepo} fallback={<SkeletonDashboard />}>
            <MetricsDashboard repo={currentRepo} />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-6 py-12 text-center">
            <p className="text-sm text-neutral-500">
              Select a repository above or enter a custom one to see its engineering health metrics.
            </p>
          </div>
        )}

        <footer className="flex items-center justify-between pt-4 border-t border-neutral-900 text-xs text-neutral-700">
          <span>Built by Karthik Poojary</span>
          <div className="flex gap-4">
            <a
              href="https://github.com/KarthikPoojary"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-500 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/karthikpoojary"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-500 transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
