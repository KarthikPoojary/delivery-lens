'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const PRESETS = [
  { repo: 'kubernetes/kubernetes', label: 'kubernetes/kubernetes', note: 'GKE · Container Orchestration' },
  { repo: 'grpc/grpc', label: 'grpc/grpc', note: 'gRPC · All GCP APIs' },
  { repo: 'istio/istio', label: 'istio/istio', note: 'Anthos · Service Mesh' },
];

export default function RepoPicker({ currentRepo }: { currentRepo: string }) {
  const router = useRouter();
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');

  function select(repo: string) {
    router.push(`/?repo=${encodeURIComponent(repo)}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = custom.trim();
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(trimmed)) {
      setError('Use the format owner/repo');
      return;
    }
    setError('');
    select(trimmed);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PRESETS.map(({ repo, label, note }) => {
          const active = currentRepo === repo;
          return (
            <button
              key={repo}
              onClick={() => select(repo)}
              className={`px-4 py-3 rounded-lg border text-left transition-colors ${
                active
                  ? 'border-indigo-500 bg-indigo-950/60'
                  : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500 hover:bg-neutral-800'
              }`}
            >
              <p className={`text-sm font-mono ${active ? 'text-indigo-300' : 'text-neutral-300'}`}>{label}</p>
              <p className="text-[11px] text-neutral-600 mt-0.5">{note}</p>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setError('');
            }}
            placeholder="owner/repo"
            className="w-full px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-100 font-mono text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm hover:bg-neutral-700 transition-colors shrink-0"
        >
          Analyze
        </button>
      </form>
    </div>
  );
}
