using BookingApp.Domain;

namespace BookingApp.Tests;

// Shared test data. Every test builds its own store and clock, so no test can affect another.
internal static class TestData
{
    // 2026-10-19 is a Monday (weekday 1 in the provider's weekly hours).
    public const string Monday = "2026-10-19";

    public static MemoryStore NewStore() => new();

    public static Provider MondayProvider(string id = "p1", int slotMinutes = 30) => new()
    {
        Id = id,
        Name = "Alex",
        Title = "Stylist",
        SlotMinutes = slotMinutes,
        WeeklyHours = new Dictionary<string, List<Window>>
        {
            ["1"] = new List<Window> { new Window("09:00", "17:00") },
        },
    };

    public static Actor Patron(string id, string name = "Pat", string email = "pat@test.com") =>
        new(id, name, email, "patron");

    public static Actor Provider(string providerId) =>
        new("u-prov", "Alex", "alex@salon.test", "provider", providerId);

    public static Func<DateTime> Clock(string iso) => () => DateTime.Parse(iso);

    public static Appointment Booked(
        MemoryStore store,
        string providerId,
        string date,
        string start,
        string? patronId = null,
        string status = "booked",
        string? manageToken = null)
    {
        var appt = new Appointment
        {
            Id = Guid.NewGuid().ToString(),
            ProviderId = providerId,
            Date = date,
            Start = start,
            End = EndOf(start, 30),
            AttendeeName = "Someone",
            ContactEmail = "someone@test.com",
            PatronId = patronId,
            BookedBy = patronId is null ? "anonymous" : "patron",
            Status = status,
            ManageToken = manageToken ?? $"token-{Guid.NewGuid():N}",
            CreatedAt = "2026-10-01T00:00:00.0000000",
        };
        store.Appointments.Insert(appt);
        return appt;
    }

    public static string EndOf(string start, int minutes)
    {
        var parts = start.Split(':');
        var total = int.Parse(parts[0]) * 60 + int.Parse(parts[1]) + minutes;
        return $"{total / 60:00}:{total % 60:00}";
    }
}
