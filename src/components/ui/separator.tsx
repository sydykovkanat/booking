"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = false,
  ...props
}: SeparatorPrimitive.Props & {
  /** Purely visual: hidden from assistive tech (`role="none"`). */
  decorative?: boolean
}) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      // Plain (not `data-*`) size classes so a consumer `w-auto`/`h-4` wins.
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className
      )}
      {...(decorative && { role: "none", "aria-orientation": undefined })}
      {...props}
    />
  )
}

export { Separator }
