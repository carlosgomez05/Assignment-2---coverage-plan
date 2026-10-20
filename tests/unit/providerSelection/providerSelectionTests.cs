using BookingApp.Domain;

namespace BookingApp.Domain.UnitTests.providerSelection;

public class ProviderSelectionTests
{
    private static readonly ServiceOffering Haircut = new("haircut", "Haircut", 30);
    private static readonly ServiceOffering Colour = new("colour", "Colour", 60);
    private static readonly ServiceOffering Trim = new("trim", "Trim", 15);


    // Helpers  
    private static TimeOnly At(string time) => TimeOnly.ParseExact(time, "HH:mm", System.Globalization.CultureInfo.InvariantCulture);

    private static Provider Weekday(string id, int slotMinutes) =>
        new(id, "Provider " + id, "Stylist", slotMinutes, new Dictionary<DayOfWeek, (TimeOnly, TimeOnly)>
        {
            [DayOfWeek.Monday] = (At("09:00"), At("17:00")),
            [DayOfWeek.Tuesday] = (At("09:00"), At("17:00")),
            [DayOfWeek.Wednesday] = (At("09:00"), At("17:00")),
            [DayOfWeek.Thursday] = (At("09:00"), At("17:00")),
            [DayOfWeek.Friday] = (At("09:00"), At("17:00")),
        });

    private static Provider WithHours(string id, int slotMinutes, DayOfWeek day, string open, string close) =>
        new(id, "Provider " + id, "Stylist", slotMinutes,
            new Dictionary<DayOfWeek, (TimeOnly, TimeOnly)> { [day] = (At(open), At(close)) });
}