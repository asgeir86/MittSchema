using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;
using MittSchema.Api.Contracts;
using MittSchema.Api.Domain;
using Xunit;

namespace MittSchema.Api.Tests;

public class IsolationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public IsolationTests(ApiFactory factory) => _factory = factory;

    // Skapar en andra handläggare direkt via UserManager (utöver den seedade).
    private async Task EnsureSecondHandlaggare(string login, string password)
    {
        using var scope = _factory.Services.CreateScope();
        var userMgr = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await userMgr.FindByNameAsync(login) is null)
        {
            var u = new ApplicationUser { UserName = login, Email = login, DisplayName = login };
            await userMgr.CreateAsync(u, password);
            await userMgr.AddToRoleAsync(u, Roles.Handlaggare);
        }
    }

    [Fact]
    public async Task Caseload_only_shows_own_clients()
    {
        await EnsureSecondHandlaggare("hl2@demo.local", "Handlaggare#2");

        var hl1 = await TestAuth.LoginSeededHandlaggareAsync(_factory);
        var created = await hl1.PostAsJsonAsync("/api/clients", new CreateClientRequest("Klient HL1"));
        var client1 = await created.Content.ReadFromJsonAsync<CreateClientResponse>();

        var hl2 = await TestAuth.LoginAsync(_factory, "hl2@demo.local", "Handlaggare#2");
        var list = await hl2.GetFromJsonAsync<List<ClientSummary>>("/api/clients");

        list.Should().NotContain(c => c.ClientUserId == client1!.ClientUserId);
    }

    [Fact]
    public async Task Handlaggare_cannot_read_other_handlaggares_client()
    {
        await EnsureSecondHandlaggare("hl3@demo.local", "Handlaggare#3");

        var hl1 = await TestAuth.LoginSeededHandlaggareAsync(_factory);
        var created = await hl1.PostAsJsonAsync("/api/clients", new CreateClientRequest("Klient privat"));
        var client1 = await created.Content.ReadFromJsonAsync<CreateClientResponse>();

        var hl3 = await TestAuth.LoginAsync(_factory, "hl3@demo.local", "Handlaggare#3");
        var res = await hl3.GetAsync($"/api/clients/{client1!.ClientUserId}");

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
