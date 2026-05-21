/**
 * A lightweight className merging utility.
 * Since clsx and tailwind-merge are not installed, this custom helper
 * merges class lists, conditionally applying classnames from strings,
 * arrays, or key-value objects.
 */
export function cn(
  ...inputs: (
    | string
    | undefined
    | null
    | boolean
    | Record<string, boolean>
    | (string | undefined | null | boolean | Record<string, boolean>)[]
  )[]
): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      classes.push(cn(...input));
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          classes.push(key);
        }
      }
    }
  }
  return classes.join(' ');
}
