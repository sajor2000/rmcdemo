"use client";

import type { WorkflowStep } from "@/lib/types";
import SourceBadge from "./SourceBadge";

function StepIcon({
  status,
  index,
}: {
  status: WorkflowStep["status"];
  index: number;
}) {
  if (status === "complete") {
    return (
      <div
        className="w-8 h-8 rounded-full bg-success-500 flex items-center justify-center shadow-sm ring-4 ring-green-50"
        aria-label="Complete"
      >
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div
        className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center shadow-sm ring-4 ring-primary-100"
        aria-label="In progress"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse-dot" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div
        className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow-sm ring-4 ring-red-50"
        aria-label="Error"
      >
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center text-[11px] font-semibold text-gray-400"
      aria-label="Pending"
    >
      {index + 1}
    </div>
  );
}

export default function WorkflowProgress({
  steps,
  artifactIds,
  onStepClick,
}: {
  steps: WorkflowStep[];
  artifactIds: Set<string>;
  onStepClick?: (artifactId: string) => void;
}) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const hasArtifact = step.artifactId && artifactIds.has(step.artifactId);
        const clickable = hasArtifact && onStepClick;

        return (
          <div
            key={step.id}
            className={`flex items-start gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
              clickable
                ? "cursor-pointer hover:bg-primary-50"
                : ""
            }`}
            onClick={() => {
              if (clickable && step.artifactId) onStepClick(step.artifactId);
            }}
          >
            <div className="flex flex-col items-center">
              <StepIcon status={step.status} index={i} />
              {i < steps.length - 1 && (
                <div
                  className={`w-0.5 h-7 mt-1 rounded-full transition-colors ${
                    step.status === "complete" ? "bg-success-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
            <div className="pt-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-medium ${
                    step.status === "active"
                      ? "text-primary-700"
                      : step.status === "complete"
                      ? "text-gray-700"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </p>
                {hasArtifact && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    View
                  </span>
                )}
              </div>
              {step.detail && (
                <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
              )}
              {step.sources && step.sources.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.sources.map((source) => (
                    <SourceBadge key={source} source={source} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
