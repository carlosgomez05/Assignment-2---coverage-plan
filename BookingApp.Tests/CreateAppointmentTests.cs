using BookingApp.Domain;
using NUnit.Framework;

namespace BookingApp.Tests;

// Unit: AppointmentService.Create — appointment rules.
// Expected results come from the requirements (docs/ARCHITECTURE.md assumptions
// A1-A8 and the API contract), not from reading the code under test.
[TestFixture]
public class CreateAppointmentTests
{
    [Test]
    public void Create_ValidFutureSlot_ReturnsBookedAppointment()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var patron = TestData.Patron("u1");

        // Act
        var result = service.Create(patron, new CreateAppointmentInput("p1", TestData.Monday, "09:00"));

        // Assert
        Assert.That(result.Status, Is.EqualTo("booked"));
        Assert.That(result.Start, Is.EqualTo("09:00"));
        Assert.That(result.End, Is.EqualTo("09:30"));
        Assert.That(result.PatronId, Is.EqualTo("u1"));
    }

    [Test]
    public void Create_BookingExactlyAtCurrentTime_ThrowsInThePast()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T09:00:00"));
        var patron = TestData.Patron("u1");

        // Act / Assert
        Assert.That(
            () => service.Create(patron, new CreateAppointmentInput("p1", TestData.Monday, "09:00")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("cannot book a time in the past")
                .And.Property("Code").EqualTo("IN_THE_PAST"));
    }

    [Test]
    public void Create_BookingThirtyMinutesAhead_ReturnsBookedAppointment()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:30:00"));
        var patron = TestData.Patron("u1");

        // Act
        var result = service.Create(patron, new CreateAppointmentInput("p1", TestData.Monday, "09:00"));

        // Assert
        Assert.That(result.Status, Is.EqualTo("booked"));
        Assert.That(result.Start, Is.EqualTo("09:00"));
    }

    [Test]
    public void Create_SlotAlreadyBooked_ThrowsSlotTaken()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        TestData.Booked(store, "p1", TestData.Monday, "09:00");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var patron = TestData.Patron("u1");

        // Act / Assert
        Assert.That(
            () => service.Create(patron, new CreateAppointmentInput("p1", TestData.Monday, "09:00")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("that slot has just been taken")
                .And.Property("Code").EqualTo("SLOT_TAKEN"));
    }

    [Test]
    public void Create_AnonymousWhenRegistrationRequired_ThrowsRegistrationRequired()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        store.Settings.RequireRegistration = true;
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));

        // Act / Assert
        Assert.That(
            () => service.Create(null, new CreateAppointmentInput("p1", TestData.Monday, "09:00", "Warren", "warren@test.com")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("this vendor requires you to register before booking")
                .And.Property("Code").EqualTo("REGISTRATION_REQUIRED"));
    }

    [Test]
    public void Create_InvalidDateFormat_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var patron = TestData.Patron("u1");

        // Act / Assert
        Assert.That(
            () => service.Create(patron, new CreateAppointmentInput("p1", "19/10/2026", "09:00")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("date must be YYYY-MM-DD")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }

    [Test]
    public void Create_ProviderOnAnotherProvidersCalendar_ThrowsForbidden()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var otherProvider = TestData.Provider("p2");

        // Act / Assert
        Assert.That(
            () => service.Create(otherProvider, new CreateAppointmentInput("p1", TestData.Monday, "09:00")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("providers can only book on their own calendar")
                .And.Property("Code").EqualTo("FORBIDDEN"));
    }

    [Test]
    public void Create_PatronWithoutContactEmail_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var patronWithNoEmail = TestData.Patron("u1", email: "");

        // Act / Assert
        Assert.That(
            () => service.Create(patronWithNoEmail, new CreateAppointmentInput("p1", TestData.Monday, "09:00")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("a valid contactEmail is required")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }

    [Test]
    public void Create_MissingAttendeeName_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var patronWithoutName = TestData.Patron("u1", name: "");

        // Act / Assert
        Assert.That(
            () => service.Create(patronWithoutName, new CreateAppointmentInput("p1", TestData.Monday, "09:00")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("attendeeName is required")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }

    [Test]
    public void Create_ProviderWalkInWithoutContactEmail_ReturnsBookedAppointment()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var provider = TestData.Provider("p1");

        // Act
        var result = service.Create(provider, new CreateAppointmentInput("p1", TestData.Monday, "09:00", "Walk-in"));

        // Assert
        Assert.That(result.Status, Is.EqualTo("booked"));
        Assert.That(result.ContactEmail, Is.EqualTo("alex@salon.test"));
        Assert.That(result.BookedBy, Is.EqualTo("provider"));
    }
}
