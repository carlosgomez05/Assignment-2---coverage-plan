using BookingApp.Domain;
using NUnit.Framework;

namespace BookingApp.Tests;

// Unit: AuthService.Register — patron registration rules.
// Expected results come from the requirements (registration and login in
// docs/ARCHITECTURE.md and the API contract), not from reading the code under test.
[TestFixture]
public class RegisterTests
{
    [Test]
    public void Register_ValidInput_ReturnsPublicUserWithoutPassword()
    {
        // Arrange
        var store = TestData.NewStore();
        var service = new AuthService(store);
        var input = new CreateUserInput("Warren Bwogi", "Warren@Test.com", "password123");

        // Act
        var result = service.Register(input);

        // Assert
        Assert.That(result.Name, Is.EqualTo("Warren Bwogi"));
        Assert.That(result.Email, Is.EqualTo("warren@test.com"));
        Assert.That(result.Role, Is.EqualTo("patron"));
        Assert.That(result.Id, Is.Not.Empty);
    }

    [Test]
    public void Register_PasswordExactlyEightCharacters_ReturnsPublicUser()
    {
        // Arrange
        var store = TestData.NewStore();
        var service = new AuthService(store);
        var input = new CreateUserInput("Warren Bwogi", "warren@test.com", "12345678");

        // Act
        var result = service.Register(input);

        // Assert
        Assert.That(result.Email, Is.EqualTo("warren@test.com"));
    }

    [Test]
    public void Register_PasswordSevenCharacters_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        var service = new AuthService(store);
        var input = new CreateUserInput("Warren Bwogi", "warren@test.com", "1234567");

        // Act / Assert
        Assert.That(
            () => service.Register(input),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("password must be at least 8 characters")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }

    [Test]
    public void Register_InvalidEmailFormat_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        var service = new AuthService(store);
        var input = new CreateUserInput("Warren Bwogi", "not-an-email", "password123");

        // Act / Assert
        Assert.That(
            () => service.Register(input),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("a valid email is required")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }

    [Test]
    public void Register_DuplicateEmailDifferentCase_ThrowsEmailTaken()
    {
        // Arrange
        var store = TestData.NewStore();
        var service = new AuthService(store);
        service.Register(new CreateUserInput("Warren Bwogi", "warren@test.com", "password123"));

        // Act / Assert
        Assert.That(
            () => service.Register(new CreateUserInput("Warren Again", "WARREN@TEST.COM", "password123")),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("email already registered")
                .And.Property("Code").EqualTo("EMAIL_TAKEN"));
    }

    [Test]
    public void Register_MissingName_ThrowsBadRequest()
    {
        // Arrange
        var store = TestData.NewStore();
        var service = new AuthService(store);
        var input = new CreateUserInput("", "warren@test.com", "password123");

        // Act / Assert
        Assert.That(
            () => service.Register(input),
            Throws.TypeOf<AppError>()
                .With.Message.EqualTo("name is required")
                .And.Property("Code").EqualTo("BAD_REQUEST"));
    }
}
