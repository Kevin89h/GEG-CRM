import { cn } from "@/lib/utils"
import { type ButtonHTMLAttributes } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
}

const variants = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-sm",
  secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm",
  ghost: "hover:bg-gray-100 text-gray-600",
  danger: "bg-red-600 hover:bg-red-500 text-white shadow-sm",
}

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
