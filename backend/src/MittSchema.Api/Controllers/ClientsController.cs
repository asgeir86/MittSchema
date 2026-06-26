using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using MittSchema.Api.Contracts;
using MittSchema.Api.Data;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Controllers;

[ApiController]
[Route("api/clients")]
[Authorize(Roles = Roles.Handlaggare)]
public class ClientsController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly AppDbContext _db;

    public ClientsController(UserManager<ApplicationUser> users, AppDbContext db)
    {
        _users = users;
        _db = db;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateClientRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { errors = new[] { "Name kravs." } });

        var handlaggareId = _users.GetUserId(User)!;
        // Full GUID i loginnamnet (ingen trunkering) → ingen kollisionsrisk.
        var login = $"klient-{Guid.NewGuid():N}@klient.local";
        var oneTimeCode = GenerateCode();

        var user = new ApplicationUser
        {
            UserName = login,
            Email = login,
            DisplayName = req.Name,
            MustChangePassword = true
        };
        var created = await _users.CreateAsync(user, oneTimeCode);
        if (!created.Succeeded)
            return BadRequest(new { errors = created.Errors.Select(e => e.Description) });

        // Provisioneringen ska vara allt-eller-inget. Om roll/profil/schema misslyckas
        // EFTER att Identity-anvandaren skapats, ta bort anvandaren sa inget foraldralost
        // konto blir kvar. TODO Fas 5: byt till en riktig DB-transaktion (Postgres; EF
        // InMemory saknar transaktioner) som omsluter bade Identity- och domanskrivningar.
        try
        {
            var roleResult = await _users.AddToRoleAsync(user, Roles.Klient);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(
                    $"AddToRoleAsync misslyckades: {string.Join(", ", roleResult.Errors.Select(e => e.Description))}");

            _db.ClientProfiles.Add(new ClientProfile
            {
                UserId = user.Id,
                HandlaggareId = handlaggareId,
                Name = req.Name
            });
            _db.Schedules.Add(new Schedule { ClientUserId = user.Id, Data = "{}" });
            await _db.SaveChangesAsync();
        }
        catch
        {
            await _users.DeleteAsync(user);
            throw;
        }

        return Created($"/api/clients/{user.Id}",
            new CreateClientResponse(user.Id, req.Name, login, oneTimeCode));
    }

    // Engångskod: 12 tecken (Ms + 10), lättläst (inga 0/O/1/I), uppfyller lösenordskraven.
    // "Ms"-prefixet garanterar versal+gemen+längd. Den lilla modulo-biasen i
    // teckenfördelningen är känd och acceptabel för en engångskod som dessutom
    // tvingar lösenordsbyte vid första inloggning.
    private static string GenerateCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        var bytes = RandomNumberGenerator.GetBytes(10);
        var chars = bytes.Select(b => alphabet[b % alphabet.Length]).ToArray();
        return "Ms" + new string(chars); // "Ms"-prefix garanterar versal+gemen+längd
    }
}
