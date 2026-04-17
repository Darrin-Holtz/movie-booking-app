export const SHOWTIME_PRICES: Record<string, number> = {
  "12:00 PM": 12,
  "3:30 PM": 14,
  "6:45 PM": 18,
  "9:15 PM": 16,
};

export const getShowtimePrice = (time: string) => SHOWTIME_PRICES[time] ?? 14;
