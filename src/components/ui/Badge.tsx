import { cn } from "@/lib/utils"

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "blue" | "green" | "yellow" | "red" | "gray" | "purple"
  className?: string
}

const variants = {
  default: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-600",
  purple: "bg-purple-100 text-purple-700",
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  )
}
