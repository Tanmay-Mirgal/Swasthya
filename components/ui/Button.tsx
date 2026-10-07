import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "highlight";
  size?: "sm" | "md" | "lg" | "xl" | "icon";
  asChild?: boolean;
}

/**
 * One button vocabulary:
 *  primary   — the single next action on a screen (Swasthya green)
 *  secondary — supporting action (toner outline)
 *  outline   — quiet bordered action
 *  ghost     — tertiary / toolbar
 *  danger    — destructive or "stop"
 *  highlight — rare "needs attention" call to action
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
          {
            "bg-emerald-600 text-white hover:bg-emerald-700": variant === "primary",
            "border border-slate-900 bg-white text-slate-900 hover:bg-slate-100": variant === "secondary",
            "border border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50": variant === "outline",
            "text-slate-700 hover:bg-slate-100 hover:text-slate-900": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700": variant === "danger",
            "bg-amber-300 text-[var(--ink)] hover:bg-amber-400": variant === "highlight",
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4": size === "md",
            "h-12 px-6 text-base": size === "lg",
            "h-14 px-7 text-lg": size === "xl",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
