using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
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
}
