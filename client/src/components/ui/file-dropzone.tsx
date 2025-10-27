import * as React from "react";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  id?: string;
  accept?: string;
  disabled?: boolean;
  className?: string;
  onSelect(file: File): void;
};

export function FileDropzone({
  id,
  accept,
  disabled = false,
  className,
  onSelect,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleFiles(list: FileList | null) {
    const file = list?.[0];
    if (file) onSelect(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    handleFiles(e.dataTransfer.files ?? null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  return (
    <>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onKeyDown={onKeyDown}
        className={cn(
          "min-h-40 w-full rounded-md border-2 border-dashed",
          "border-teal-500/80 bg-teal-50/30 text-teal-700",
          "flex items-center justify-center text-center p-6",
          "transition-colors",
          "hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <div className="space-y-2 pointer-events-none">
          <svg
            aria-hidden="true"
            className="mx-auto h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 19V6m0 0l-5 5m5-5l5 5" />
          </svg>

          <p className="text-sm font-medium">
            Drop a file here to upload, or
            <br />
            <span className="underline underline-offset-4">
              click here to browse
            </span>
          </p>
        </div>
      </div>
    </>
  );
}
