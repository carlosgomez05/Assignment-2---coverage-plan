using BookingApp.Domain;

namespace BookingApp.Domain.UnitTests.providerSelection;

public class ProviderSelectionTests
{
    private static readonly ServiceOffering Haircut = new("haircut", "Haircut", 30);
    private static readonly ServiceOffering Colour = new("colour", "Colour", 60);
    private static readonly ServiceOffering Trim = new("trim", "Trim", 15);

    /* OFFERS SERVICE */

    // A 30-minute haircut fits a provider who books 30-minute slots.
    [Test]
    public void OffersService_ServiceFitsSlotLength_ReturnsTrue()
    {
        var provider = Weekday("Alex", slotMinutes: 30);

        var offeredService = ProviderSelection.OffersService(provider, Haircut);

        Assert.That(offeredService, Is.True);
    }

    // A 60-minute colour fits a provider who books 30-minute slots as two slots.
    [Test]
    public void OffersService_ServiceLongerThanButAMultipleOfSlotLength_ReturnsTrue()
    {
        var provider = Weekday("Alex", slotMinutes: 30);

        var offeredService = ProviderSelection.OffersService(provider, Colour);

        Assert.That(offeredService, Is.True);
    }

    // A 15-minute trim does not fit a provider who books 30-minute slots.
    [Test]
    public void OffersService_ServiceShorterThanSlotLength_ReturnsFalse()
    {
        var provider = Weekday("Alex", slotMinutes: 30);

        var offeredService = ProviderSelection.OffersService(provider, Trim);

        Assert.That(offeredService, Is.False);
    }

    // A 75-minute service does not fit a provider who books 30-minute slots.
    [Test]
    public void OffersService_ServiceNotAMultipleOfSlotLength_ReturnsFalse()
    {
        var provider = Weekday("Sam", slotMinutes: 60);
        var serviceBundle = new ServiceOffering("service-bundle", "Colour + Wash", 75);

        var offeredService = ProviderSelection.OffersService(provider, serviceBundle);

        Assert.That(offeredService, Is.False);
    }

    // A provider with zero slot length cannot offer any service.
    [Test]
    public void OffersService_ZeroSlotLength_ReturnsFalse()
    {
        var provider = Weekday("Sam", slotMinutes: 0);

        var offeredService = ProviderSelection.OffersService(provider, Haircut);

        Assert.That(offeredService, Is.False);
    }

    /* PROVIDERS FOR */

    // The provider with the shortest slot length is offered first, even if the other provider has a longer slot length that can also accommodate the service. 
    [Test]
    public void ProvidersFor_MultipleProvidersWithSameService_ReturnsTheProviderWithTheShortestSlotLengthFirst()
    {
        var providerHalfHour = Weekday("Alex", slotMinutes: 30);
        var providerOneHour = Weekday("Sam", slotMinutes: 60);

        var providers = ProviderSelection.ProvidersFor(new[] { providerHalfHour, providerOneHour }, Haircut);

        Assert.That(providers.Select(p => p.Id), Is.EqualTo(new[] { "Alex" }));
    }

    // If no providers offer the service, an empty list is returned.
    [Test]
    public void ProvidersFor_NoProvidersOfferTheService_ReturnsEmptyList()
    {
        var providerOneHour = Weekday("Sam", slotMinutes: 60);

        var providers = ProviderSelection.ProvidersFor(new[] { providerOneHour }, Trim);

        Assert.That(providers, Is.Empty);
    }

    /* PROVIDE FOR DAY */

    // If a provider has room for the service on the requested day, they are returned.
    [Test]
    public void ProvideForDay_ProviderHasRoomForService_ReturnsProvider()
    {
        var provider = Weekday("Sam", slotMinutes: 60);
        var booked = Array.Empty<TimeWindow>();

        var providers = ProviderSelection.ProvideForDay(new[] { provider }, Colour, DayOfWeek.Wednesday, booked);

        Assert.That(providers.Select(p => p.Id), Is.EqualTo(new[] { "Sam" }));
    }

    // If a provider has no room for the service on the requested day, an empty list is returned.
    [Test]
    public void ProvideForDay_ProviderHasNoRoomForService_ReturnsEmptyList()
    {
        var provider = Weekday("Alex", slotMinutes: 30);
        var booked = new List<TimeWindow> { new(At("09:00"), At("17:00")) };

        var providers = ProviderSelection.ProvideForDay(new[] { provider }, Haircut, DayOfWeek.Tuesday, booked);

        Assert.That(providers, Is.Empty);
    }

    // If a provider's morning is all taken, they have nothing to offer.
    [Test]
    public void ProvideForDay_ProviderHasRoomForServiceButNotEnoughConsecutiveSlots_ReturnsEmptyList()
    {
        var provider = WithHours("Alex", 30, DayOfWeek.Tuesday, "09:00", "12:00");
        var booked = new[] { new TimeWindow(At("09:00"), At("12:00")) };

        var providers = ProviderSelection.ProvideForDay(new[] { provider }, Haircut, DayOfWeek.Tuesday, booked);

        Assert.That(providers, Is.Empty);
    }

    // If a provider has room for a 30-minute haircut but not a 60-minute colour, they are only offered the haircut.
    [Test]
    public void ProvideForDay_ProviderOnlyHasRoomForASpecificLengthService_ReturnsProvider()
    {
        var provider = WithHours("Alex", 30, DayOfWeek.Friday, "09:00", "17:00");
        var booked = new[] { new TimeWindow(At("09:00"), At("13:30")), new TimeWindow(At("14:00"), At("17:00")) };

        var providersForHaircut = ProviderSelection.ProvideForDay(new[] { provider }, Haircut, DayOfWeek.Friday, booked);
        var providersForColour = ProviderSelection.ProvideForDay(new[] { provider }, Colour, DayOfWeek.Friday, booked);

        Assert.Multiple(() =>
        {
            Assert.That(providersForHaircut.Select(p => p.Id), Is.EqualTo(new[] { "Alex" }));
            Assert.That(providersForColour, Is.Empty);
        });
    }

    // Exactly two consecutive free slots is enough for a 60-minute service.
    [Test]
    public void ProvideForDay_SixtyMinuteServiceWithTwoFreeSlotsInARow_IsOffered()
    {
        var provider = WithHours("Alex", 30, DayOfWeek.Monday, "09:00", "14:30");
        var booked = new[] { new TimeWindow(At("10:00"), At("13:30")) };

        var offered = ProviderSelection.ProvideForDay(new[] { provider }, Colour, DayOfWeek.Monday, booked);

        Assert.That(offered.Select(p => p.Id), Is.EqualTo(new[] { "Alex" }));
    }

    // A provider with no hours that day cannot be offered.
    [Test]
    public void ProvideForDay_DayTheProviderDoesNotWork_IsNotOffered()
    {
        var provider = WithHours("Sam", 60, DayOfWeek.Saturday, "09:00", "17:00");
        var booked = Array.Empty<TimeWindow>();

        var offered = ProviderSelection.ProvideForDay(new[] { provider }, Haircut, DayOfWeek.Saturday, booked);

        Assert.That(offered, Is.Empty);
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