namespace BookingApp.Domain;

// Mirrors src/domain/availability.js. Provider shape:
//   { slotMinutes: 30, weeklyHours: { "1": [{ start: "09:00", end: "17:00" }], ... } }
// weeklyHours keys are weekday numbers (0 = Sunday).
public static class Availability
{
    public static bool Overlaps(int aStart, int aEnd, int bStart, int bEnd) => aStart < bEnd && bStart < aEnd;

    /// Every bookable slot a provider offers on a date, ignoring existing bookings.
    public static List<Slot> SlotsForDay(Provider provider, string date)
    {
        var slots = new List<Slot>();
        var windows = provider.WeeklyHours.TryGetValue(TimeHelpers.Weekday(date).ToString(), out var w) ? w : null;
        if (windows is null) return slots;
        var step = provider.SlotMinutes;
        foreach (var window in windows)
        {
            var end = TimeHelpers.ToMinutes(window.End);
            for (var s = TimeHelpers.ToMinutes(window.Start); s + step <= end; s += step)
            {
                slots.Add(new Slot(TimeHelpers.ToHHMM(s), TimeHelpers.ToHHMM(s + step)));
            }
        }
        return slots;
    }

    /// True if [start, end) overlaps any booked appointment ("HH:MM" strings).
    public static bool HasConflict(IEnumerable<Appointment> booked, string start, string end)
    {
        var s = TimeHelpers.ToMinutes(start);
        var e = TimeHelpers.ToMinutes(end);
        return booked.Any(b => Overlaps(s, e, TimeHelpers.ToMinutes(b.Start), TimeHelpers.ToMinutes(b.End)));
    }

    /// Slots for a day with an `available` flag, given the provider's active bookings that day.
    public static List<SlotStatus> SlotsWithStatus(Provider provider, string date, IEnumerable<Appointment> booked) =>
        SlotsForDay(provider, date)
            .Select(slot => new SlotStatus(slot.Start, slot.End, !HasConflict(booked, slot.Start, slot.End)))
            .ToList();

    /// The slot starting at `start` on that day, or null if it is not on the provider's grid.
    public static Slot? FindSlot(Provider provider, string date, string start) =>
        SlotsForDay(provider, date).FirstOrDefault(s => s.Start == start);
}
