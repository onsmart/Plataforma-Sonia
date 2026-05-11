"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";

import { cn } from "./utils";
import { toggleVariants } from "./toggle";

type ToggleGroupMode = "single" | "multiple";

type ToggleGroupContextValue = {
  mode: ToggleGroupMode;
  disabled: boolean;
  variant: VariantProps<typeof toggleVariants>["variant"];
  size: VariantProps<typeof toggleVariants>["size"];
  toggleItem: (value: string) => void;
  isSelected: (value: string) => boolean;
};

const ToggleGroupVariantContext = React.createContext<
  Pick<ToggleGroupContextValue, "variant" | "size">
>({
  size: "default",
  variant: "default",
});

const ToggleGroupBehaviourContext = React.createContext<ToggleGroupContextValue | null>(
  null
);

function useToggleGroupContext() {
  const ctx = React.useContext(ToggleGroupBehaviourContext);
  if (!ctx) {
    throw new Error("ToggleGroupItem must be used within ToggleGroup");
  }
  return ctx;
}

type ToggleGroupBaseProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children" | "defaultValue" | "onValueChange" | "value"
> &
  VariantProps<typeof toggleVariants> & {
    children?: React.ReactNode;
    disabled?: boolean;
  };

type ToggleGroupSingleProps = ToggleGroupBaseProps & {
  type: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

type ToggleGroupMultipleProps = ToggleGroupBaseProps & {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  function ToggleGroup(props, ref) {
    const {
      type,
      className,
      variant,
      size,
      disabled = false,
      children,
      value: _value,
      defaultValue: _defaultValue,
      onValueChange: _onValueChange,
      ...rest
    } = props;

    const isSingle = type === "single";
    const singleProps = isSingle ? props : null;
    const multipleProps = !isSingle ? props : null;

    const [singleUncontrolled, setSingleUncontrolled] = React.useState<string>(
      singleProps?.defaultValue ?? ""
    );
    const [multiUncontrolled, setMultiUncontrolled] = React.useState<string[]>(
      multipleProps?.defaultValue ?? []
    );

    const controlledSingle = singleProps?.value !== undefined;
    const singleValue = controlledSingle
      ? (singleProps!.value as string)
      : singleUncontrolled;

    const controlledMulti = multipleProps?.value !== undefined;
    const multiValue = controlledMulti
      ? (multipleProps!.value as string[])
      : multiUncontrolled;

    const toggleItem = React.useCallback(
      (itemValue: string) => {
        if (disabled) return;
        if (isSingle) {
          const next = singleValue === itemValue ? "" : itemValue;
          if (!controlledSingle) setSingleUncontrolled(next);
          singleProps?.onValueChange?.(next);
        } else {
          const prev = multiValue;
          const has = prev.includes(itemValue);
          const next = has
            ? prev.filter((v) => v !== itemValue)
            : [...prev, itemValue];
          if (!controlledMulti) setMultiUncontrolled(next);
          multipleProps?.onValueChange?.(next);
        }
      },
      [
        disabled,
        isSingle,
        singleValue,
        multiValue,
        controlledSingle,
        controlledMulti,
        singleProps,
        multipleProps,
      ]
    );

    const isSelected = React.useCallback(
      (itemValue: string) => {
        if (isSingle) return singleValue === itemValue;
        return multiValue.includes(itemValue);
      },
      [isSingle, singleValue, multiValue]
    );

    const ctx = React.useMemo<ToggleGroupContextValue>(
      () => ({
        mode: type,
        disabled,
        variant: variant ?? "default",
        size: size ?? "default",
        toggleItem,
        isSelected,
      }),
      [type, disabled, variant, size, toggleItem, isSelected]
    );

    const variantCtx = React.useMemo(
      () => ({ variant: variant ?? "default", size: size ?? "default" }),
      [variant, size]
    );

    return (
      <ToggleGroupBehaviourContext.Provider value={ctx}>
        <ToggleGroupVariantContext.Provider value={variantCtx}>
          <div
            ref={ref}
            role={isSingle ? "radiogroup" : "group"}
            data-slot="toggle-group"
            data-variant={variant}
            data-size={size}
            className={cn(
              "group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs",
              className
            )}
            {...rest}
          >
            {children}
          </div>
        </ToggleGroupVariantContext.Provider>
      </ToggleGroupBehaviourContext.Provider>
    );
  }
);
ToggleGroup.displayName = "ToggleGroup";

type ToggleGroupItemProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "data-state" | "value"
> &
  VariantProps<typeof toggleVariants> & {
    value: string;
  };

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  function ToggleGroupItem(
    {
      className,
      children,
      variant,
      size,
      value: itemValue,
      disabled,
      onClick,
      ...props
    },
    ref
  ) {
    const { variant: gv, size: gs } = React.useContext(ToggleGroupVariantContext);
    const {
      mode,
      disabled: groupDisabled,
      variant: cv,
      size: cs,
      toggleItem,
      isSelected,
    } = useToggleGroupContext();

    const v = variant ?? cv ?? gv;
    const s = size ?? cs ?? gs;
    const on = isSelected(itemValue);
    const btnDisabled = Boolean(disabled ?? groupDisabled);

    return (
      <button
        ref={ref}
        type="button"
        role={mode === "single" ? "radio" : undefined}
        aria-checked={mode === "single" ? on : undefined}
        aria-pressed={mode === "multiple" ? on : undefined}
        data-slot="toggle-group-item"
        data-variant={v}
        data-size={s}
        data-state={on ? "on" : "off"}
        disabled={btnDisabled}
        className={cn(
          toggleVariants({
            variant: v,
            size: s,
          }),
          "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
          className
        )}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented || btnDisabled) return;
          toggleItem(itemValue);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
