using BookingApp.Domain;
using NUnit.Framework;

namespace BookingApp.Tests;

// Unit: AuthService.Login — patron registration rules for signing in.
// Expected results come from the requirements, not from reading the code under test.
[TestFixture]
public class LoginTests
{
    private static AuthService RegisteredUserService()
    {
        var store = TestData.NewStore();
        var service = new AuthService(store);
        service.Register(new CreateUserInput("Warren Bwogi", "warren@test.com", "password123"));
        return service;
    }

    [Test]
    public void Login_CorrectCredentials_ReturnsTokenAndUser()
    {
        // Arrange
        var service = RegisteredUserService();

        // Act
        var result = service.Login("warren@test.com", "password123");

        // Assert
        Assert.That(result.Token, Is.Not.Empty);
        Assert.That(result.User.Email, Is.EqualTo("warren@test.com"));
        Assert.That(result.User.Role, Is.EqualTo("patron"));
    }

    [Test]
    public void Login_WrongPassword_ThrowsUnauthorized()
    {
        // Arrange
        var service = RegisteredUserService();

        // Act / Assert
        Assert.That(
            () => service.Login("warren@test.com", "wrong-password"),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("invalid email or password")
                .And.Property("Code").EqualTo("BAD_CREDENTIALS"));
    }

    [Test]
    public void Login_UnknownEmail_ThrowsUnauthorized()
    {
        // Arrange
        var service = RegisteredUserService();

        // Act / Assert
        Assert.That(
            () => service.Login("nobody@test.com", "password123"),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("invalid email or password")
                .And.Property("Code").EqualTo("BAD_CREDENTIALS"));
    }

    [Test]
    public void Login_EmailDifferentCase_ReturnsToken()
    {
        // Arrange
        var service = RegisteredUserService();

        // Act
        var result = service.Login("WARREN@TEST.COM", "password123");

        // Assert
        Assert.That(result.Token, Is.Not.Empty);
        Assert.That(result.User.Email, Is.EqualTo("warren@test.com"));
    }

    [Test]
    public void Login_MissingPassword_ThrowsUnauthorized()
    {
        // Arrange
        var service = RegisteredUserService();

        // Act / Assert
        Assert.That(
            () => service.Login("warren@test.com", null),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("invalid email or password")
                .And.Property("Code").EqualTo("BAD_CREDENTIALS"));
    }

    [Test]
    public void ActorFromToken_RevokedSession_ReturnsNull()
    {
        // Arrange
        var service = RegisteredUserService();
        var login = service.Login("warren@test.com", "password123");

        // Act
        service.Logout(login.Token);
        var actor = service.ActorFromToken(login.Token);

        // Assert
        Assert.That(actor, Is.Null);
    }

    [Test]
    public void ActorFromToken_ValidSession_ReturnsPatron()
    {
        // Arrange
        var service = RegisteredUserService();
        var login = service.Login("warren@test.com", "password123");

        // Act
        var actor = service.ActorFromToken(login.Token);

        // Assert
        Assert.That(actor, Is.Not.Null);
        Assert.That(actor.Role, Is.EqualTo("patron"));
        Assert.That(actor.Email, Is.EqualTo("warren@test.com"));
    }
}
