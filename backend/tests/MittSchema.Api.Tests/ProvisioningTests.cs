using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MittSchema.Api.Contracts;
using MittSchema.Api.Data;
using Xunit;

namespace MittSchema.Api.Tests;

public class ProvisioningTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public ProvisioningTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Handlaggare_creates_client_and_gets_one_time_code()
    {
        var hl = await TestAuth.LoginSeededHandlaggareAsync(_factory);

        var res = await hl.PostAsJsonAsync("/api/clients", new CreateClientRequest("Anna Andersson"));
        res.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await res.Content.ReadFromJsonAsync<CreateClientResponse>();
        body!.Name.Should().Be("Anna Andersson");
        body.OneTimeCode.Should().NotBeNullOrWhiteSpace();
        body.ClientUserId.Should().NotBeNullOrWhiteSpace();

        // Klienten kan logga in med engångskoden och måste byta lösenord.
        var klient = _factory.CreateClient();
        var login = await klient.PostAsJsonAsync("/api/auth/login",
            new { Login = body.Login, Password = body.OneTimeCode });
        login.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>();
        loginBody!.MustChangePassword.Should().BeTrue();

        // Ett tomt schema ska ha skapats för klienten.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Schedules.Any(s => s.ClientUserId == body.ClientUserId).Should().BeTrue();
    }

    [Fact]
    public async Task Anonymous_cannot_create_client()
    {
        var anon = _factory.CreateClient();
        var res = await anon.PostAsJsonAsync("/api/clients", new CreateClientRequest("X"));
        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Klient_cannot_create_client_gets_403()
    {
        // Handläggaren provisionerar en klient, sedan loggar vi in SOM klienten.
        var hl = await TestAuth.LoginSeededHandlaggareAsync(_factory);
        var created = await hl.PostAsJsonAsync("/api/clients", new CreateClientRequest("Ny Klient"));
        var body = await created.Content.ReadFromJsonAsync<CreateClientResponse>();

        var klient = await TestAuth.LoginAsync(_factory, body!.Login, body.OneTimeCode);
        var forbidden = await klient.PostAsJsonAsync("/api/clients", new CreateClientRequest("Obehorig"));

        forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Create_with_empty_name_returns_400()
    {
        var hl = await TestAuth.LoginSeededHandlaggareAsync(_factory);
        var res = await hl.PostAsJsonAsync("/api/clients", new CreateClientRequest(""));
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
