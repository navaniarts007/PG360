import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

/** Minimal Radix-style Slot: merges props onto a single child element. */
export function Slot({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  const childProps = child.props as { className?: string };
  return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
    ...props,
    ...childProps,
    className: cn(className, childProps.className),
  });
}
