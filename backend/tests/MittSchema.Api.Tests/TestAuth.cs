using System.Net.Http.Json;

namespace MittSchema.Api.Tests;

public static class TestAuth
{
    // Loggar in och returnerar en HttpClient vars cookie-container håller sessionen.
    public static async Task<HttpClient> LoginAsync(ApiFactory factory, string login, string password)
    {
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login", new { Login = login, Password = password });
        res.EnsureSuccessStatusCode();
        return client;
    }

    public static Task<HttpClient> LoginSeededHandlaggareAsync(ApiFactory factory)
        => LoginAsync(factory, "handlaggare@demo.local", "Handlaggare#1");
}
