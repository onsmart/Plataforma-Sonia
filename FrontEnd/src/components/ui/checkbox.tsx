"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "./utils"

export type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "checked" | "defaultChecked" | "onCheckedChange" | "role"
> & {
  checked?: boolean | "indeterminate"
  defaultChecked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean | "indeterminate") => void
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      className,
      checked: checkedProp,
      defaultChecked,
      disabled,
      onCheckedChange,
      onClick,
      ...props
    },
    ref
  ) => {
    const [uncontrolled, setUncontrolled] = React.useState<boolean | "indeterminate">(
      () => defaultChecked ?? false
    )

    const isControlled = checkedProp !== undefined
    const checked = isControlled ? checkedProp : uncontrolled

    function setChecked(next: boolean | "indeterminate") {
      if (!isControlled) setUncontrolled(next)
      onCheckedChange?.(next)
    }

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked === "indeterminate" ? "mixed" : checked ? "true" : "false"}
        data-slot="checkbox"
        data-state={checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked"}
        disabled={disabled}
        className={cn(
          "peer border bg-input-background dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center",
          className
        )}
        onClick={(e) => {
          onClick?.(e)
          if (e.defaultPrevented || disabled) return
          if (checked === "indeterminate") setChecked(true)
          else setChecked(!checked)
        }}
        {...props}
      >
        <span
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-current transition-none pointer-events-none"
        >
          {checked === true ? (
            <CheckIcon className="size-3.5" />
          ) : checked === "indeterminate" ? (
            <span className="block h-0.5 w-2.5 shrink-0 rounded-sm bg-current" aria-hidden />
          ) : null}
        </span>
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
