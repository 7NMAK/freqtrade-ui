import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn("ft-card flex flex-col", className)}
      {...props}
    />
  )
}

function CardHeader({ className, title, icon, action, children, ...props }: React.ComponentProps<"div"> & { title?: string; icon?: string; action?: React.ReactNode }) {
  // If legacy props (title/icon/action) are used, render them; otherwise render children
  const hasLegacyProps = title || icon || action;
  if (hasLegacyProps) {
    return (
      <div
        data-slot="card-header"
        className={cn("flex items-center justify-between px-4 py-3", className)}
        {...props}
      >
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title && <span className="text-sm font-bold">{title}</span>}
        </div>
        {action}
      </div>
    );
  }
  return (
    <div
      data-slot="card-header"
      className={cn("ft-card-header", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("ft-card-title", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5 w-full flex-1", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
        className
      )}
      {...props}
    />
  )
}

const CardBody = CardContent;

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardBody,
}
