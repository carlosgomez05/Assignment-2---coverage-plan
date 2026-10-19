using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace BookingApp.Domain;

// Mirrors src/services/appointmentService.js. The clock is injected exactly like
// the JavaScript version so time-dependent rules are testable without the system clock.
public partial class AppointmentService
{
    [GeneratedRegex(@"^\S+@\S+\.\S+$")]
    private static partial Regex EmailRegex();

    private readonly MemoryStore _store;
    private readonly SettingsService _settings;
    private readonly Func<DateTime> _clock;

    public AppointmentService(MemoryStore store, SettingsService settings, Func<DateTime>? clock = null)
    {
        _store = store;
        _settings = settings;
        _clock = clock ?? (() => DateTime.Now);
    }

    private List<Appointment> ActiveFor(string providerId, string date, string? excludeId) =>
        _store.Appointments.Where(a =>
            a.ProviderId == providerId && a.Date == date && a.Status == "booked" && a.Id != excludeId);

    /// Shared validation for create and reschedule. Throws if the slot is not bookable.
    private Slot AssertBookable(string providerId, string date, string start, string? excludeId = null)
    {
        if (!TimeHelpers.IsDate(date)) throw Errors.BadRequest("date must be YYYY-MM-DD");
        if (!TimeHelpers.IsTime(start)) throw Errors.BadRequest("start must be HH:MM");
        var provider = _store.Providers.Get(providerId)
            ?? throw Errors.NotFound("provider not found", "PROVIDER_NOT_FOUND");
        var slot = Availability.FindSlot(provider, date, start)
            ?? throw Errors.BadRequest("that time is not an available slot for this provider", "NOT_A_SLOT");
        if (TimeHelpers.ToDateTime(date, start) <= _clock())
        {
            throw Errors.BadRequest("cannot book a time in the past", "IN_THE_PAST");
        }
        // Check-and-insert runs synchronously, so two requests cannot both pass. With a real DB,
        // back this with a unique constraint or transaction (see risk R3 in the strategy).
        if (Availability.HasConflict(ActiveFor(providerId, date, excludeId), slot.Start, slot.End))
        {
            throw Errors.Conflict("that slot has just been taken", "SLOT_TAKEN");
        }
        return slot;
    }

    /// Can this actor manage this appointment? Patron owner, the provider, or holder of the manage token.
    private static void AssertCanManage(Appointment appt, Actor? actor, string? manageToken)
    {
        var isProvider = actor?.Role == "provider" && actor.ProviderId == appt.ProviderId;
        var isOwner = actor?.Role == "patron" && appt.PatronId == actor.Id;
        var hasToken = !string.IsNullOrEmpty(manageToken) && manageToken == appt.ManageToken;
        if (!isProvider && !isOwner && !hasToken) throw Errors.Forbidden("you cannot manage this appointment");
    }

    private Appointment Load(string id) =>
        _store.Appointments.Get(id) ?? throw Errors.NotFound("appointment not found", "APPOINTMENT_NOT_FOUND");

    private static AppointmentView ToView(Appointment appt, bool includeToken = false) => new(
        appt.Id,
        appt.ProviderId,
        appt.Date,
        appt.Start,
        appt.End,
        appt.AttendeeName,
        appt.ContactEmail,
        appt.PatronId,
        appt.BookedBy,
        appt.Status,
        includeToken ? appt.ManageToken : null,
        appt.CreatedAt,
        appt.UpdatedAt,
        appt.CancelledAt,
        appt.CancelledBy);

    /// input: { providerId, date, start, attendeeName?, contactEmail? }
    /// - patron: books for self or for someone else (attendeeName), any provider, any time
    /// - provider: books on their own calendar for a walk-in / phone customer
    /// - anonymous: allowed unless the vendor requires registration; needs name + email
    public AppointmentView Create(Actor? actor, CreateAppointmentInput? input)
    {
        if (actor is null && _settings.Get().RequireRegistration)
        {
            throw Errors.Unauthorized("this vendor requires you to register before booking", "REGISTRATION_REQUIRED");
        }
        var providerId = input?.ProviderId ?? "";
        var date = input?.Date ?? "";
        var start = input?.Start ?? "";
        if (actor?.Role == "provider" && actor.ProviderId != providerId)
        {
            throw Errors.Forbidden("providers can only book on their own calendar");
        }

        var attendeeName = (input?.AttendeeName ?? actor?.Name ?? "").Trim();
        var contactEmail = (input?.ContactEmail ?? actor?.Email ?? "").Trim().ToLower();
        if (attendeeName == "") throw Errors.BadRequest("attendeeName is required");
        if (actor?.Role != "provider" && !EmailRegex().IsMatch(contactEmail))
        {
            throw Errors.BadRequest("a valid contactEmail is required");
        }

        var slot = AssertBookable(providerId, date, start);
        var appt = new Appointment
        {
            Id = Guid.NewGuid().ToString(),
            ProviderId = providerId,
            Date = date,
            Start = slot.Start,
            End = slot.End,
            AttendeeName = attendeeName,
            ContactEmail = contactEmail == "" ? null : contactEmail,
            PatronId = actor?.Role == "patron" ? actor.Id : null,
            BookedBy = actor?.Role ?? "anonymous",
            Status = "booked",
            ManageToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(12)),
            CreatedAt = _clock().ToString("o"),
        };
        _store.Appointments.Insert(appt);
        return ToView(appt, includeToken: true);
    }

    /// Change provider, date/time, or attendee details. Rescheduling frees the old slot automatically.
    public AppointmentView Update(Actor? actor, string id, AppointmentChanges changes, string? manageToken = null)
    {
        var appt = Load(id);
        AssertCanManage(appt, actor, manageToken);
        if (appt.Status != "booked")
        {
            throw Errors.Conflict("cancelled appointments cannot be changed", "ALREADY_CANCELLED");
        }

        var nextProviderId = changes.ProviderId ?? appt.ProviderId;
        var nextDate = changes.Date ?? appt.Date;
        var nextStart = changes.Start ?? appt.Start;
        var nextEnd = appt.End;
        var moved = nextProviderId != appt.ProviderId || nextDate != appt.Date || nextStart != appt.Start;

        if (moved)
        {
            var slot = AssertBookable(nextProviderId, nextDate, nextStart, appt.Id);
            nextEnd = slot.End;
        }

        var nextAttendee = appt.AttendeeName;
        if (changes.HasAttendeeName)
        {
            if (string.IsNullOrWhiteSpace(changes.AttendeeName))
            {
                throw Errors.BadRequest("attendeeName cannot be empty");
            }
            nextAttendee = changes.AttendeeName!.Trim();
        }

        var nextEmail = appt.ContactEmail;
        if (changes.HasContactEmail)
        {
            if (!EmailRegex().IsMatch(changes.ContactEmail ?? ""))
            {
                throw Errors.BadRequest("a valid contactEmail is required");
            }
            nextEmail = changes.ContactEmail!.ToLower();
        }

        appt.ProviderId = nextProviderId;
        appt.Date = nextDate;
        appt.Start = nextStart;
        appt.End = nextEnd;
        appt.AttendeeName = nextAttendee;
        appt.ContactEmail = nextEmail;
        appt.UpdatedAt = _clock().ToString("o");
        return ToView(appt);
    }

    /// Cancelling marks the appointment cancelled; its slot is available again because
    /// only 'booked' appointments block time (assumption A6).
    public AppointmentView Cancel(Actor? actor, string id, string? manageToken = null)
    {
        var appt = Load(id);
        AssertCanManage(appt, actor, manageToken);
        if (appt.Status == "cancelled") return ToView(appt);
        appt.Status = "cancelled";
        appt.CancelledAt = _clock().ToString("o");
        appt.CancelledBy = actor?.Role ?? "anonymous";
        return ToView(appt);
    }

    public AppointmentView Get(Actor? actor, string id, string? manageToken = null)
    {
        var appt = Load(id);
        AssertCanManage(appt, actor, manageToken);
        return ToView(appt);
    }

    /// Patrons see what they booked (including for others); providers see their calendar.
    public List<AppointmentView> List(Actor? actor, string? date = null, string? status = null)
    {
        if (actor is null) throw Errors.Unauthorized();
        Func<Appointment, bool> mine = actor.Role == "provider"
            ? a => a.ProviderId == actor.ProviderId
            : a => a.PatronId == actor.Id;
        return _store.Appointments
            .Where(a => mine(a) && (date is null || a.Date == date) && (status is null || a.Status == status))
            .OrderBy(a => $"{a.Date}{a.Start}")
            .Select(a => ToView(a))
            .ToList();
    }
}
