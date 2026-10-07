import { cn } from "@/lib/utils"
import { IconLoader } from "@tabler/icons-react"

type SpinnerProps = React.ComponentProps<"svg"> & {
  /** Screen-reader text announced via role="status". */
  label?: string
  "data-icon"?: "inline-start" | "inline-end"
}

/**
 * Standalone: wraps the svg in a `display: contents` live region with an
 * sr-only label. Used as an icon next to visible text (`data-icon` set, or
 * `aria-hidden`), it renders only the decorative svg so the label does not
 * leak into the parent's accessible name.
 */
function Spinner({ className, label = "Loading", ...props }: SpinnerProps) {
  const icon = (
    <IconLoader
      data-slot="spinner"
      aria-hidden
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )

  if (props["data-icon"] || props["aria-hidden"]) {
    return icon
  }

  return (
    <span role="status" className="contents">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  )
}

export { Spinner }
