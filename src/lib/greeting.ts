/**
 * Dynamically computes a time-based greeting based on the browser's local time.
 * 
 * Rules:
 * - 5:00 AM – 11:59 AM → “Good morning, {name}” / “Good morning”
 * - 12:00 PM – 4:59 PM → “Good afternoon, {name}” / “Good afternoon”
 * - 5:00 PM – 8:59 PM → “Good evening, {name}” / “Good evening”
 * - 9:00 PM – 4:59 AM → “Working late, {name}?” / “Working late?”
 * 
 * Fallback:
 * If name is missing, returns greeting without name.
 * If time cannot be determined, returns "Kaeo Workspace".
 */
export const getTimeBasedGreeting = (name?: string): string => {
  try {
    const hour = new Date().getHours();
    const cleanName = name ? name.trim() : '';

    if (hour >= 5 && hour < 12) {
      return cleanName ? `Good morning, ${cleanName}` : 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return cleanName ? `Good afternoon, ${cleanName}` : 'Good afternoon';
    } else {
      return cleanName ? `Good evening, ${cleanName}` : 'Good evening';
    }
  } catch (e) {
    console.error('[Greeting Engine] Failed to parse local browser time:', e);
    return 'Kaeo Workspace';
  }
};
