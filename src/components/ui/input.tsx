import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

type InputSize = "sm" | "default" | "lg"

// Heights match Button sm / default / lg. Touch keeps 16px text so iOS does not zoom.
const inputVariants = cva(
  "w-full min-w-0 rounded-lg border border-transparent bg-input/50 py-1 transition-[color,box-shadow] duration-base outline-none file:mr-3 file:inline-flex file:cursor-pointer file:items-center file:rounded-md file:border-0 file:bg-background file:px-3 file:text-sm file:font-medium file:text-foreground file:shadow-card file:transition-colors placeholder:text-muted-foreground hover:file:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/80 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&[readonly]]:cursor-default [&[readonly]]:bg-muted/60 [&[readonly]]:text-muted-foreground [&[type=file]]:pl-1.5",
  {
    variants: {
      size: {
        sm: "h-9 px-2.5 text-sm file:h-6 pointer-coarse:text-base",
        default: "h-10 px-3 text-base file:h-7",
        lg: "h-12 px-4 text-base file:h-8 [&[type=file]]:pl-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  size?: InputSize
}

function Input({ className, type, size = "default", ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  )
}

export { Input, type InputSize }
