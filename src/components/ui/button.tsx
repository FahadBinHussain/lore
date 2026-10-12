"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn group/button inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all outline-none select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "btn-primary text-primary-content hover:opacity-90 shadow-sm border-transparent",
        outline:
          "btn-outline border border-base-content/25 bg-transparent text-base-content hover:bg-primary hover:text-primary-content hover:border-primary shadow-none",
        secondary:
          "btn-secondary text-secondary-content hover:opacity-90 shadow-sm border-transparent",
        accent:
          "btn-accent text-accent-content hover:opacity-90 shadow-sm border-transparent",
        ghost:
          "btn-ghost border-transparent bg-transparent text-base-content hover:bg-base-200 shadow-none",
        destructive:
          "btn-error text-error-content hover:opacity-90 shadow-sm border-transparent",
        link: "btn-link text-primary underline-offset-4 hover:underline shadow-none border-none bg-transparent",
      },
      size: {
        default:
          "h-9 min-h-9 gap-1.5 px-3.5 text-sm rounded-lg has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 min-h-6 gap-1 rounded-md px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 min-h-8 gap-1 rounded-md px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 min-h-11 gap-2 px-5 text-base rounded-xl has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        icon: "size-8 min-h-8 min-w-8 p-0 rounded-lg",
        "icon-xs":
          "size-6 min-h-6 min-w-6 p-0 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 min-h-7 min-w-7 p-0 rounded-md",
        "icon-lg": "size-9 min-h-9 min-w-9 p-0 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
