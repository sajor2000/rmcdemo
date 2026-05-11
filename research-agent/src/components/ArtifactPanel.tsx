"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Artifact } from "@/lib/types";

function DownloadButton({ artifact }: { artifact: Artifact }) {
  function download() {
    const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <button
      onClick={download}
      className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex items-center gap-1"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {artifact.filename}
    </button>
  );
}

function isSafeHref(href: string | undefined): href is string {
  if (!href) return false;
  return /^(https?:|mailto:)/i.test(href);
}

export default function ArtifactPanel({
  artifacts,
  activeId,
  onSelectArtifact,
}: {
  artifacts: Artifact[];
  activeId: string | null;
  onSelectArtifact: (id: string) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  const active = artifacts.find((a) => a.id === activeId) || artifacts[0];

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [active?.id]);

  if (artifacts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto">
          {artifacts.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelectArtifact(a.id)}
              className={`text-xs px-3 py-1.5 rounded-md whitespace-nowrap transition-all ${
                active.id === a.id
                  ? "bg-primary-600 text-white font-medium shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <DownloadButton artifact={active} />
      </div>

      {/* Artifact header */}
      <div className="px-6 pt-4 pb-2 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{active.label}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {active.filename} &middot; {(active.content.length / 1024).toFixed(1)} KB
          </p>
        </div>
        <span className="text-[10px] font-medium text-success-500 bg-green-50 px-2 py-0.5 rounded-full">
          Generated
        </span>
      </div>

      {/* Content */}
      <div ref={contentRef} className="p-6 max-h-[600px] overflow-y-auto markdown-content">
        {active.id === "evidence_table_csv" ? (
          <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre">
            {active.content}
          </pre>
        ) : (
          <ReactMarkdown
            components={{
              img: () => null,
              a: ({ href, children }) =>
                isSafeHref(href) ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                    {children}
                  </a>
                ) : (
                  <span>{children}</span>
                ),
            }}
          >
            {active.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
