namespace BookingApp.Domain;

// Transcription of the provider-selection logic behind GET /api/providers
// (src/services/providerService.js) and the slot grid it uses
// (src/domain/availability.js: slotsForDay / slotsWithStatus).
// The originals are untouched; this is the testable stand-in.

/// <summary>A provider of services: how long a booking lasts, and the hours they work.</summary>
public sealed record Provider(
    string Id,
    string Name,
    string Title,
    int SlotMinutes,
    IReadOnlyDictionary<DayOfWeek, (TimeOnly Open, TimeOnly Close)> Hours);

/// <summary>A service a patron can book.</summary>
public sealed record ServiceOffering(string Id, string Name, int DurationMinutes);

/// <summary>A half-open block of time, [Start, End).</summary>
public readonly record struct TimeWindow(TimeOnly Start, TimeOnly End);

/// <summary>
/// Which providers can be offered to a patron for a service.
/// A provider is offered when the service fits their slot length and they have room for it on
/// the requested day. A provider may offer several services, and a service may be offered by
/// several providers.
/// </summary>
public static class ProviderSelection
{
    /// <summary>
    /// True when the service takes a whole, non-zero number of the provider's slots.
    /// A 30-minute haircut fits a 30-minute grid; a 60-minute colour fits a 30-minute grid
    /// as two slots; a 15-minute trim does not fit a 30-minute grid because half a slot cannot
    /// be sold.
    /// </summary>
    public static bool OffersService(Provider provider, ServiceOffering service)
    {
        ArgumentNullException.ThrowIfNull(provider);
        ArgumentNullException.ThrowIfNull(service);
        return provider.SlotMinutes > 0
            && service.DurationMinutes > 0
            && service.DurationMinutes % provider.SlotMinutes == 0;
    }

    /// <summary>How many grid slots one appointment of the service needs; 0 if it cannot fit.</summary>
    public static int SlotsNeeded(Provider provider, ServiceOffering service) =>
        OffersService(provider, service) ? service.DurationMinutes / provider.SlotMinutes : 0;

    /// <summary>Providers who offer the service, in the order they were given.</summary>
    public static IReadOnlyList<Provider> ProvidersFor(IEnumerable<Provider> providers, ServiceOffering service) =>
        providers.Where(p => OffersService(p, service)).ToList();

    /// <summary>
    /// Providers who offer the service and still have room for it on <paramref name="day"/>:
    /// a run of consecutive free slots as long as the service needs. Existing bookings are passed
    /// in, so the answer never depends on the system clock or on when the question is asked.
    /// </summary>
    public static IReadOnlyList<Provider> ProvideForDay(
    IEnumerable<Provider> providers,
    ServiceOffering service,
    DayOfWeek day,
    IEnumerable<TimeWindow> bookedForProvider)
    {
        var taken = bookedForProvider?.ToList() ?? new List<TimeWindow>();
        return ProvidersFor(providers, service)
            .Where(p => HasRunOfFreeSlots(p, service, day, taken))
            .ToList();
    }

    /// <summary>The provider's slots on a day, each flagged with whether it is free. Port of slotsWithStatus.</summary>
    public static IReadOnlyList<(TimeWindow Slot, bool Available)> SlotsWithStatus(
        Provider provider, DayOfWeek day, IEnumerable<TimeWindow> booked)
    {
        var taken = booked.ToList();
        return SlotsForDay(provider, day)
            .Select(slot => (slot, Available: !taken.Any(b => Overlaps(slot, b))))
            .ToList();
    }

    /// <summary>Port of overlaps: true when two half-open blocks share any time at all.</summary>
    public static bool Overlaps(TimeWindow a, TimeWindow b) => a.Start < b.End && b.Start < a.End;

    // Port of slotsForDay: slots step from opening time and must end on or before closing time.
    private static IEnumerable<TimeWindow> SlotsForDay(Provider provider, DayOfWeek day)
    {
        var step = TimeSpan.FromMinutes(provider.SlotMinutes);
        if (!provider.Hours.TryGetValue(day, out var hours)) yield break;
        for (var s = hours.Open; s.Add(step) <= hours.Close; s = s.Add(step))
            yield return new TimeWindow(s, s.Add(step));
    }

    private static bool HasRunOfFreeSlots(Provider provider, ServiceOffering service, DayOfWeek day, IReadOnlyList<TimeWindow> booked)
    {
        var needed = SlotsNeeded(provider, service);
        var run = 0;
        foreach (var (_, available) in SlotsWithStatus(provider, day, booked))
        {
            run = available ? run + 1 : 0;
            if (run == needed) return true;
        }
        return false;
    }
}