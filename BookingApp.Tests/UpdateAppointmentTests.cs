using BookingApp.Domain;
using NUnit.Framework;

namespace BookingApp.Tests;

// Unit: AppointmentService.Update — appointment rules for changing bookings.
// Expected results come from the requirements (docs/ARCHITECTURE.md and the
// API contract), not from reading the code under test.
[TestFixture]
public class UpdateAppointmentTests
{
    [Test]
    public void Update_RescheduleToFreeSlot_ReturnsNewSlotTimes()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");
        var changes = new AppointmentChanges { Start = "10:00" };

        // Act
        var result = service.Update(owner, booked.Id, changes);

        // Assert
        Assert.That(result.Start, Is.EqualTo("10:00"));
        Assert.That(result.End, Is.EqualTo("10:30"));
        Assert.That(result.Status, Is.EqualTo("booked"));
    }

    [Test]
    public void Update_CancelledAppointment_ThrowsAlreadyCancelled()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1", status: "cancelled");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");
        var changes = new AppointmentChanges { Start = "10:00" };

        // Act / Assert
        Assert.That(
            () => service.Update(owner, booked.Id, changes),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("cancelled appointments cannot be changed")
                .And.Property("Code").EqualTo("ALREADY_CANCELLED"));
    }

    [Test]
    public void Update_RescheduleIntoTakenSlot_ThrowsSlotTaken()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        TestData.Booked(store, "p1", TestData.Monday, "10:00", patronId: "u2");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");
        var changes = new AppointmentChanges { Start = "10:00" };

        // Act / Assert
        Assert.That(
            () => service.Update(owner, booked.Id, changes),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("that slot has just been taken")
                .And.Property("Code").EqualTo("SLOT_TAKEN"));
    }

    [Test]
    public void Update_EmptyAttendeeName_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");
        var changes = new AppointmentChanges { HasAttendeeName = true, AttendeeName = "   " };

        // Act / Assert
        Assert.That(
            () => service.Update(owner, booked.Id, changes),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("attendeeName cannot be empty")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }

    [Test]
    public void Update_InvalidContactEmail_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");
        var changes = new AppointmentChanges { HasContactEmail = true, ContactEmail = "not-an-email" };

        // Act / Assert
        Assert.That(
            () => service.Update(owner, booked.Id, changes),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("a valid contactEmail is required")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }

    [Test]
    public void Update_NonOwnerActor_ThrowsForbidden()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var someoneElse = TestData.Patron("u2");
        var changes = new AppointmentChanges { Start = "10:00" };

        // Act / Assert
        Assert.That(
            () => service.Update(someoneElse, booked.Id, changes),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("you cannot manage this appointment")
                .And.Property("Code").EqualTo("FORBIDDEN"));
    }

    [Test]
    public void Update_NoChanges_KeepsExistingBooking()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var booked = TestData.Booked(store, "p1", TestData.Monday, "09:00", patronId: "u1");
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");

        // Act
        var result = service.Update(owner, booked.Id, new AppointmentChanges());

        // Assert
        Assert.That(result.Start, Is.EqualTo("09:00"));
        Assert.That(result.End, Is.EqualTo("09:30"));
        Assert.That(result.UpdatedAt, Is.Not.Null);
    }

    [Test]
    public void Update_UnknownAppointmentId_ThrowsNotFound()
    {
        // Arrange
        var store = TestData.NewStore();
        store.Providers.Insert(TestData.MondayProvider());
        var settings = new SettingsService(store);
        var service = new AppointmentService(store, settings, TestData.Clock("2026-10-19T08:00:00"));
        var owner = TestData.Patron("u1");

        // Act / Assert
        Assert.That(
            () => service.Update(owner, "no-such-id", new AppointmentChanges()),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("appointment not found")
                .And.Property("Code").EqualTo("APPOINTMENT_NOT_FOUND"));
    }
}
