'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const PRESETS = [
  {
    instance: 'chromium-review.googlesource.com',
    project: 'chromium/src',
    label: 'chromium/src',
    note: 'Google Chrome · chromium-review',
  },
  {
    instance: 'fuchsia-review.googlesource.com',
    project: 'fuchsia',
    label: 'fuchsia',
    note: "Google's Fuchsia OS · fuchsia-review",
  },
  {
    instance: 'dart-review.googlesource.com',
    project: 'sdk',
    label: 'dart/sdk',
    note: 'Dart SDK · Flutter · dart-review',
  },
];

function encodeParams(instance: string, project: string) {
  return `instance=${encodeURIComponent(instance)}&project=${encodeURIComponent(project)}`;
}

export default function GerritPicker({
  currentInstance,
  currentProject,
}: {
  currentInstance: string;
  currentProject: string;
}) {
  const router = useRouter();
  const [customInstance, setCustomInstance] = useState('');
  const [customProject, setCustomProject] = useState('');
  const [error, setError] = useState('');

  function select(instance: string, project: string) {
    router.push(`/gerrit?${encodeParams(instance, project)}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const inst = customInstance.trim();
    const proj = customProject.trim();
    if (!inst || !proj) {
      setError('Both instance and project are required');
      return;
    }
    if (!inst.includes('.')) {
      setError('Instance should be a hostname (e.g. chromium-review.googlesource.com)');
      return;
    }
    setError('');
    select(inst, proj);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PRESETS.map(({ instance, project, label, note }) => {
          const active = currentInstance === instance && currentProject === project;
          return (
            <button
              key={`${instance}/${project}`}
              onClick={() => select(instance, project)}
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

      <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap sm:flex-nowrap">
        <div className="w-full sm:flex-1 min-w-0">
          <input
            type="text"
            value={customInstance}
            onChange={e => { setCustomInstance(e.target.value); setError(''); }}
            placeholder="instance (e.g. chromium-review.googlesource.com)"
            className="w-full px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-100 font-mono text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div className="w-full sm:flex-1 min-w-0">
          <input
            type="text"
            value={customProject}
            onChange={e => { setCustomProject(e.target.value); setError(''); }}
            placeholder="project (e.g. chromium/src)"
            className="w-full px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-100 font-mono text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm hover:bg-neutral-700 transition-colors shrink-0"
        >
          Analyze
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
