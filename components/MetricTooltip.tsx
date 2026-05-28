export default function MetricTooltip({ content }: { content: string }) {
  return (
    <div className="relative group inline-block">
      <div className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-500 text-[10px] flex items-center justify-center cursor-default select-none hover:border-neutral-500 hover:text-neutral-400 transition-colors">
        ?
      </div>
      <div className="pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 leading-relaxed z-20 shadow-xl">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-neutral-700" />
      </div>
    </div>
  );
}
