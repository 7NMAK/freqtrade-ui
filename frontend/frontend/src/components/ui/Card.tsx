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
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-md bg-card/60 backdrop-blur-md shadow-sm border border-white/5 data-[size=sm]:rounded-sm overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, title, icon, action, ...props }: React.ComponentProps<"div"> & { title?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  if (title || icon || action) {
    return (
      <div
        data-slot="card-header"
        className={cn("group/card-header flex items-center justify-between px-3 py-2 bg-white/[0.02]", className)}
        {...props}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="opacity-80">{icon}</span>}
          {title && <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">{title}</span>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )
  }
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header flex flex-col gap-1 px-3 pt-3",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-sans text-sm font-semibold tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs text-muted-foreground", className)}
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
      className={cn("px-3 pb-3 flex-1", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center border-t border-white/5 bg-black/20 p-3",
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
