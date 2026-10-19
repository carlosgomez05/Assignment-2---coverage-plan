namespace BookingApp.Domain;

// Data shapes that mirror the JavaScript models used across src/.

public record Window(string Start, string End);

public class Provider : IIdentifiable
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Title { get; set; } = "";
    public int SlotMinutes { get; set; } = 30;
    public Dictionary<string, List<Window>> WeeklyHours { get; set; } = new();
}

public class User : IIdentifiable
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "";
    public string? ProviderId { get; set; }
}

public class Session : IIdentifiable
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public bool Revoked { get; set; }
}

public class Appointment : IIdentifiable
{
    public string Id { get; set; } = "";
    public string ProviderId { get; set; } = "";
    public string Date { get; set; } = "";
    public string Start { get; set; } = "";
    public string End { get; set; } = "";
    public string AttendeeName { get; set; } = "";
    public string? ContactEmail { get; set; }
    public string? PatronId { get; set; }
    public string BookedBy { get; set; } = "";
    public string Status { get; set; } = "";
    public string ManageToken { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string? UpdatedAt { get; set; }
    public string? CancelledAt { get; set; }
    public string? CancelledBy { get; set; }
}

public record Actor(string Id, string Name, string Email, string Role, string? ProviderId = null);

public record PublicUser(string Id, string Name, string Email, string Role, string? ProviderId);

public record Slot(string Start, string End);

public record SlotStatus(string Start, string End, bool Available);

// Appointment as returned to callers; the manage token is only shown to whoever created it.
public record AppointmentView(
    string Id,
    string ProviderId,
    string Date,
    string Start,
    string End,
    string AttendeeName,
    string? ContactEmail,
    string? PatronId,
    string BookedBy,
    string Status,
    string? ManageToken,
    string CreatedAt,
    string? UpdatedAt,
    string? CancelledAt,
    string? CancelledBy);

public record CreateAppointmentInput(
    string? ProviderId,
    string? Date,
    string? Start,
    string? AttendeeName = null,
    string? ContactEmail = null);

public class AppointmentChanges
{
    public string? ProviderId { get; set; }
    public string? Date { get; set; }
    public string? Start { get; set; }
    public bool HasAttendeeName { get; set; }
    public string? AttendeeName { get; set; }
    public bool HasContactEmail { get; set; }
    public string? ContactEmail { get; set; }
}

public record CreateUserInput(string? Name, string? Email, string? Password, string? ProviderId = null);

public record LoginResult(string Token, PublicUser User);
