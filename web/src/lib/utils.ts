import { clsx } from "cnfast"
import type { ClassValue } from "cnfast"
import { twMerge } from "cnfast"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
