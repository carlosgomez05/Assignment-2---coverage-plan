using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace BookingApp.Domain;

// Mirrors src/services/authService.js. Passwords are hashed with a random salt;
// PBKDF2 stands in for the JavaScript scrypt so the port stays dependency-free.
public partial class AuthService
{
    [GeneratedRegex(@"^\S+@\S+\.\S+$")]
    private static partial Regex EmailRegex();

    private readonly MemoryStore _store;

    public AuthService(MemoryStore store)
    {
        _store = store;
    }

    private static string HashPassword(string password, string? salt = null)
    {
        var saltBytes = salt is null ? RandomNumberGenerator.GetBytes(16) : Convert.FromHexString(salt);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToHexString(saltBytes)}:{Convert.ToHexString(hash)}";
    }

    private static bool VerifyPassword(string password, string stored)
    {
        var parts = stored.Split(':');
        var candidate = Convert.FromHexString(HashPassword(password, parts[0]).Split(':')[1]);
        var expected = Convert.FromHexString(parts[1]);
        return CryptographicOperations.FixedTimeEquals(candidate, expected);
    }

    private static PublicUser ToPublicUser(User u) => new(u.Id, u.Name, u.Email, u.Role, u.ProviderId);

    private User? FindByEmail(string email) =>
        _store.Users.Where(u => u.Email == email.ToLower()).FirstOrDefault();

    private User CreateUser(string name, string email, string password, string role, string? providerId = null)
    {
        if (string.IsNullOrEmpty(name)) throw Errors.BadRequest("name is required");
        if (string.IsNullOrEmpty(email) || !EmailRegex().IsMatch(email)) throw Errors.BadRequest("a valid email is required");
        if (string.IsNullOrEmpty(password) || password.Length < 8) throw Errors.BadRequest("password must be at least 8 characters");
        if (FindByEmail(email) is not null) throw Errors.Conflict("email already registered", "EMAIL_TAKEN");
        return _store.Users.Insert(new User
        {
            Id = Guid.NewGuid().ToString(),
            Name = name.Trim(),
            Email = email.ToLower(),
            PasswordHash = HashPassword(password),
            Role = role,
            ProviderId = providerId,
        });
    }

    /// Public sign-up: always creates a patron.
    public PublicUser Register(CreateUserInput input) =>
        ToPublicUser(CreateUser(input.Name ?? "", input.Email ?? "", input.Password ?? "", "patron"));

    /// Used by seed/admin tooling to link a login to a provider profile.
    public PublicUser CreateProviderAccount(CreateUserInput input) =>
        ToPublicUser(CreateUser(input.Name ?? "", input.Email ?? "", input.Password ?? "", "provider", input.ProviderId));

    public LoginResult Login(string? email, string? password)
    {
        var user = email is not null ? FindByEmail(email) : null;
        if (user is null || password is null || !VerifyPassword(password, user.PasswordHash))
        {
            throw Errors.Unauthorized("invalid email or password", "BAD_CREDENTIALS");
        }
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        _store.Sessions.Insert(new Session { Id = token, UserId = user.Id });
        return new LoginResult(token, ToPublicUser(user));
    }

    public void Logout(string? token)
    {
        if (token is not null) _store.Sessions.Update(token, s => s.Revoked = true);
    }

    /// Resolve a bearer token to an "actor", or null for anonymous.
    public Actor? ActorFromToken(string? token)
    {
        if (token is null) return null;
        var session = _store.Sessions.Get(token);
        if (session is null || session.Revoked) return null;
        var user = _store.Users.Get(session.UserId);
        return user is null ? null : new Actor(user.Id, user.Name, user.Email, user.Role, user.ProviderId);
    }
}
