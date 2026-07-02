"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

if (typeof window !== 'undefined') {
  (window as any).__eternaDebugLogs = (window as any).__eternaDebugLogs || [];
  (window as any).__eternaAddDebugLog = (msg: string) => {
    const entry = { time: new Date().toLocaleTimeString(), message: msg };
    (window as any).__eternaDebugLogs.push(entry);
    window.dispatchEvent(new CustomEvent('eterna-debug-log', { detail: entry }));
  };
}

type LogEntry = {
  time: string;
  message: string;
};

export default function DebugOverlay() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const showOverlay = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isDev = process.env.NODE_ENV === 'development';
    const hasDebugParam = searchParams.has('debug');
    return isDev || hasDebugParam;
  }, [searchParams]);

  useEffect(() => {
    if (!showOverlay) return;

    // Load any logs collected before component mount
    if (typeof window !== 'undefined' && (window as any).__eternaDebugLogs) {
      setLogs([...(window as any).__eternaDebugLogs]);
    }

    const handleLogEvent = (e: Event) => {
      const customEvent = e as CustomEvent<LogEntry>;
      if (customEvent.detail) {
        setLogs(prev => [...prev, customEvent.detail]);
      }
    };

    window.addEventListener('eterna-debug-log', handleLogEvent);
    return () => {
      window.removeEventListener('eterna-debug-log', handleLogEvent);
    };
  }, [showOverlay]);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.time}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!showOverlay) return null;

  return (
    <div className="fixed top-24 right-4 z-[99999] w-[320px] max-h-[480px] bg-slate-900/95 text-slate-100 border border-slate-700 rounded-2xl shadow-2xl p-4 flex flex-col font-mono text-[10px] select-text pointer-events-auto">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2 select-none">
        <span className="font-extrabold uppercase tracking-wider text-rose-400">Eterna Mobile Debugger</span>
        <button
          onClick={handleCopyLogs}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-[9px] font-bold text-white transition-colors cursor-pointer"
        >
          {copied ? 'Copied!' : 'Copy Logs'}
        </button>
      </div>

      <div className="flex-grow overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin max-h-[380px]">
        {logs.length === 0 ? (
          <span className="text-slate-500 italic select-none">Waiting for events...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-1.5 border-b border-slate-800/40 pb-1 align-top leading-normal">
              <span className="text-slate-500 shrink-0 select-none">{log.time}</span>
              <span className="text-slate-200 break-words flex-1 whitespace-pre-wrap">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
