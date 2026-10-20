using BookingApp.Domain;

namespace BookingApp.Domain.UnitTests.providerSelection;

public class ProviderSelectionTests
{
    private static readonly ServiceOffering Haircut = new("haircut", "Haircut", 30);
    private static readonly ServiceOffering Colour = new("colour", "Colour", 60);
    private static readonly ServiceOffering Trim = new("trim", "Trim", 15);

    /* OFFERS SERVICE */
    [Test]
    public void OffersService_ServiceFitsSlotLength_ReturnsTrue() // A 30-minute haircut fits a provider who books 30-minute slots.
    {
        var provider = Weekday("Alex", slotMinutes: 30);

        var offeredService = ProviderSelection.OffersService(provider, Haircut);

        Assert.That(offeredService, Is.True);
    }

    [Test]
    public void OffersService_ServiceLongerThanButAMultipleOfSlotLength_ReturnsTrue() // A 60-minute colour fits a provider who books 30-minute slots as two slots.
    {
        var provider = Weekday("Alex", slotMinutes: 30);

        var offeredService = ProviderSelection.OffersService(provider, Colour);

        Assert.That(offeredService, Is.True);
    }

    [Test]
    public void OffersService_ServiceShorterThanSlotLength_ReturnsFalse() // A 15-minute trim does not fit a provider who books 30-minute slots.
    {
        var provider = Weekday("Alex", slotMinutes: 30);

        var offeredService = ProviderSelection.OffersService(provider, Trim);

        Assert.That(offeredService, Is.False);
    }

    [Test]
    public void OffersService_ServiceNotAMultipleOfSlotLength_ReturnsFalse() // A 75-minute service does not fit a provider who books 30-minute slots.
    {
        var provider = Weekday("Sam", slotMinutes: 60);
        var serviceBundle = new ServiceOffering("service-bundle", "Colour + Wash", 75);

        var offeredService = ProviderSelection.OffersService(provider, serviceBundle);

        Assert.That(offeredService, Is.False);
    }

    [Test]
    public void OffersService_ZeroSlotLength_ReturnsFalse() // A provider with zero slot length cannot offer any service.
    {
        var provider = Weekday("Sam", slotMinutes: 0);

        var offeredService = ProviderSelection.OffersService(provider, Haircut);

        Assert.That(offeredService, Is.False);
    }

    /* PROVIDERS FOR */
    [Test]
    public void ProvidersFor_MultipleProvidersWithSameService_ReturnsTheProviderWithTheShortestSlotLengthFirst() // The provider with the shortest slot length is offered first, even if the other provider has a longer slot length that can also accommodate the service. 
    {
        var providerHalfHour = Weekday("Alex", slotMinutes: 30);
        var providerOneHour = Weekday("Sam", slotMinutes: 60);

        var providers = ProviderSelection.ProvidersFor(new[] { providerHalfHour, providerOneHour }, Haircut);

        Assert.That(providers.Select(p => p.Id), Is.EqualTo(new[] { "Alex" }));
    }

    [Test]
    public void ProvidersFor_NoProvidersOfferTheService_ReturnsEmptyList() // If no providers offer the service, an empty list is returned.
    {
        var providerOneHour = Weekday("Sam", slotMinutes: 60);

        var providers = ProviderSelection.ProvidersFor(new[] { providerOneHour }, Trim);

        Assert.That(providers, Is.Empty);
    }

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