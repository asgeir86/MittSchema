using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        var roleMgr = sp.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { Roles.Handlaggare, Roles.Klient })
            if (!await roleMgr.RoleExistsAsync(role))
            {
                var roleCreate = await roleMgr.CreateAsync(new IdentityRole(role));
                if (!roleCreate.Succeeded)
                    throw new InvalidOperationException($"Seed: CreateAsync roll '{role}' misslyckades: {string.Join(", ", roleCreate.Errors.Select(e => e.Description))}");
            }

        var config = sp.GetRequiredService<IConfiguration>().GetSection("SeedHandlaggare");
        var login = config["Login"];
        if (string.IsNullOrWhiteSpace(login)) return;

        var password = config["Password"];
        if (string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("Seed: SeedHandlaggare:Password saknas i konfigurationen.");

        var userMgr = sp.GetRequiredService<UserManager<ApplicationUser>>();
        if (await userMgr.FindByNameAsync(login) is null)
        {
            var user = new ApplicationUser
            {
                UserName = login,
                Email = login,
                DisplayName = config["DisplayName"] ?? "Handläggare",
                MustChangePassword = false
            };
            var createResult = await userMgr.CreateAsync(user, password);
            if (!createResult.Succeeded)
                throw new InvalidOperationException($"Seed: CreateAsync misslyckades: {string.Join(", ", createResult.Errors.Select(e => e.Description))}");
            var roleResult = await userMgr.AddToRoleAsync(user, Roles.Handlaggare);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException($"Seed: AddToRoleAsync misslyckades: {string.Join(", ", roleResult.Errors.Select(e => e.Description))}");
        }
    }
}
