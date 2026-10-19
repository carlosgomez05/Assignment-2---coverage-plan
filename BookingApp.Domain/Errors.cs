namespace BookingApp.Domain;

// Mirrors src/errors.js: one error type used by every layer.
public class AppError : Exception
{
    public int Status { get; }
    public string Code { get; }

    public AppError(int status, string code, string message) : base(message)
    {
        Status = status;
        Code = code;
    }
}

public static class Errors
{
    public static AppError BadRequest(string message, string code = "BAD_REQUEST") => new(400, code, message);
    public static AppError Unauthorized(string message = "Login required", string code = "UNAUTHORIZED") => new(401, code, message);
    public static AppError Forbidden(string message = "Not allowed", string code = "FORBIDDEN") => new(403, code, message);
    public static AppError NotFound(string message = "Not found", string code = "NOT_FOUND") => new(404, code, message);
    public static AppError Conflict(string message, string code = "CONFLICT") => new(409, code, message);
}
