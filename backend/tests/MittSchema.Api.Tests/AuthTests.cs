using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using MittSchema.Api.Contracts;
using MittSchema.Api.Domain;
using Xunit;

namespace MittSchema.Api.Tests;

public class AuthTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public AuthTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Seed_creates_handlaggare_with_role()
    {
        _ = _factory.CreateClient(); // tvingar app-uppstart + seed
        using var scope = _factory.Services.CreateScope();
        var userMgr = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var user = await userMgr.FindByNameAsync("handlaggare@demo.local");
        user.Should().NotBeNull();
        (await userMgr.IsInRoleAsync(user!, Roles.Handlaggare)).Should().BeTrue();
    }

    [Fact]
    public async Task Login_with_seeded_handlaggare_succeeds()
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { Login = "handlaggare@demo.local", Password = "Handlaggare#1" });

        res.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);
        var body = await res.Content.ReadFromJsonAsync<LoginResponse>();
        body!.Role.Should().Be(Roles.Handlaggare);
        body.MustChangePassword.Should().BeFalse();
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_401()
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { Login = "handlaggare@demo.local", Password = "fel-losen" });
        res.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }
}
