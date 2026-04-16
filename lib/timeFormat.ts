const timeFormat = (minutes?: number | null): string | null => {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const minutesRemainder = minutes % 60;

  if (hours === 0) {
    return `${minutesRemainder}m`;
  }

  if (minutesRemainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutesRemainder}m`;
};

export default timeFormat;