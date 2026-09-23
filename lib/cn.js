/** Joins class names, skipping falsy values: cn("a", on && "b") */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
