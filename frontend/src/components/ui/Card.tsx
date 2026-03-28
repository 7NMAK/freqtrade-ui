import clsx from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={clsx("bg-bg-2 border border-border rounded-card overflow-hidden", className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  icon?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, icon, action }: CardHeaderProps) {
  return (
    <div className="px-6 py-4 flex items-center justify-between border-b border-border">
      <h3 className="text-sm font-semibold text-text-0 flex items-center gap-2">
        {icon && <span className="text-md">{icon}</span>}
        {title}
      </h3>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return (
    <div className={clsx("p-6", className)}>
      {children}
    </div>
  );
}
