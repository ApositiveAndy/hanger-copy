import type { ReactNode } from "react";

export function Shell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className={`mx-auto w-full max-w-lg px-5 ${footer ? "pb-44" : "pb-8"}`}>{children}</div>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg">
          <div className="mx-auto w-full max-w-lg px-5 pt-3 pb-safe">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}
