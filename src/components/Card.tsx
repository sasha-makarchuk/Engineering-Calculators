import type { PropsWithChildren, ReactNode } from "react";

// Props for the reusable card shell; children are the content inside the card.
interface CardProps extends PropsWithChildren {
  title?: ReactNode;
  icon?: string;
  className?: string;
}

// Shared card component used throughout the homepage and calculator pages.
export function Card({ title, icon, className = "", children }: CardProps) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <h2 className="card-title">
          {icon ? <i className={`${icon} mr-2 text-sky-600`} aria-hidden="true" /> : null}
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
