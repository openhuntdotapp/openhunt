import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    checked={checked}
    className={cn(
      "peer h-3.5 w-3.5 shrink-0 rounded-[3px] border border-white/25 bg-transparent transition-all duration-150 ease-out",
      "hover:border-white/40",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
      "disabled:cursor-not-allowed disabled:opacity-40",
      "data-[state=checked]:bg-white/90 data-[state=checked]:border-white/90",
      "data-[state=indeterminate]:bg-white/50 data-[state=indeterminate]:border-white/50",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center")}
    >
      {checked === "indeterminate" ? (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-[#0a0a0a]">
          <rect x="1" y="3.5" width="6" height="1" rx="0.5" fill="currentColor" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#0a0a0a]">
          <path 
            d="M2.5 5L4.5 7L7.5 3" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
