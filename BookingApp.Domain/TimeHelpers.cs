using System.Globalization;
using System.Text.RegularExpressions;

namespace BookingApp.Domain;

// Mirrors src/domain/time.js. Dates are "YYYY-MM-DD", times are "HH:MM",
// both in the vendor's local time (assumption A1: one timezone, no DST handling yet).
public static partial class TimeHelpers
{
    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")]
    private static partial Regex DateRegex();

    [GeneratedRegex(@"^([01]\d|2[0-3]):[0-5]\d$")]
    private static partial Regex TimeRegex();

    public static bool IsDate(string? d)
    {
        if (d is null || !DateRegex().IsMatch(d)) return false;
        return DateTime.TryParseExact(d, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    }

    public static bool IsTime(string? t) => t is not null && TimeRegex().IsMatch(t);

    public static int ToMinutes(string t)
    {
        var parts = t.Split(':');
        return int.Parse(parts[0]) * 60 + int.Parse(parts[1]);
    }

    public static string ToHHMM(int mins) => $"{mins / 60:00}:{mins % 60:00}";

    // 0 = Sunday ... 6 = Saturday
    public static int Weekday(string date) => (int)DateTime.Parse(date, CultureInfo.InvariantCulture).DayOfWeek;

    public static DateTime ToDateTime(string date, string time) =>
        DateTime.Parse($"{date}T{time}:00", CultureInfo.InvariantCulture);
}
