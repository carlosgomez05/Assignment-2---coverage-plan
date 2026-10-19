using BookingApp.Domain;
using NUnit.Framework;

namespace BookingApp.Tests;

// Unit: AppointmentService.Cancel — appointment rules for cancellation.
// Expected results come from the requirements (docs/ARCHITECTURE.md assumptions
// A6 and the API contract), not from reading the code under test.
[TestFixture]
public class CancelAppointmentTests
{
    [Test]
    public void Cancel_BookedAppointment_ReturnsCancelledStatus()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");

        // Act
        var result = service.Cancel(owner, booked.Id);

        // Assert
        Assert.That(result.Status, Is.EqualTo("cancelled"));
        Assert.That(result.CancelledBy, Is.EqualTo("patron"));
        Assert.That(result.CancelledAt, Is.Not.Null);
    }

    // Interpretation: cancelling an appointment that is already cancelled is a no-op,
    // not an error (assumption A6 keeps cancelled records for history).
    [Test]
    public void Cancel_AlreadyCancelledAppointment_ReturnsCancelledWithoutError()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1", status: "cancelled");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");

        // Act
        var result = service.Cancel(owner, booked.Id);

        // Assert
        Assert.That(result.Status, Is.EqualTo("cancelled"));
    }

    [Test]
    public void Cancel_NonOwnerActor_ThrowsForbidden()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var someoneElse = TestData.Patron("u2");

        // Act / Assert
        Assert.That(
            () => service.Cancel(someoneElse, booked.Id),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("you cannot manage this appointment")
                .And.Property("Code").EqualTo("FORBIDDEN"));
    }

    [Test]
    public void Cancel_ProviderCancelsOwnCalendarBooking_ReturnsCancelledStatus()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var provider = TestData.Provider("p1");

        // Act
        var result = service.Cancel(provider, booked.Id);

        // Assert
        Assert.That(result.Status, Is.EqualTo("cancelled"));
        Assert.That(result.CancelledBy, Is.EqualTo("provider"));
    }

    [Test]
    public void Cancel_WithManageToken_ReturnsCancelledStatus()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", manageToken: "guest-token");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));

        // Act
        var result = service.Cancel(null, booked.Id, "guest-token");

        // Assert
        Assert.That(result.Status, Is.EqualTo("cancelled"));
        Assert.That(result.CancelledBy, Is.EqualTo("anonymous"));
    }

    [Test]
    public void Cancel_UnknownAppointmentId_ThrowsNotFound()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");

        // Act / Assert
        Assert.That(
            () => service.Cancel(owner, "no-such-id"),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("appointment not found")
                .And.Property("Code").EqualTo("APPOINTMENT_NOT_FOUND"));
    }
}
