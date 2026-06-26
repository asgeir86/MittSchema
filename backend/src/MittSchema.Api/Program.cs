using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MittSchema.Api.Data;
using MittSchema.Api.Domain;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// DB: Postgres i drift. Testprojektet ersätter denna registrering med InMemory.
var conn = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default saknas i konfigurationen.");
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(conn));

builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(opt =>
    {
        opt.Password.RequiredLength = 8;
        opt.User.RequireUniqueEmail = false;
        // Engångskoden (och klientvalda lösenord) garanterar versal+gemen+längd, inte
        // siffra/specialtecken. Relaxa policyn därefter (planens GenerateCode-intent).
        // TODO Fas 5/produktionshärdning: omvärdera om klientvalda lösenord ska kräva
        // siffra/specialtecken igen (påverkar även lösenordet klienten själv väljer).
        opt.Password.RequireNonAlphanumeric = false;
        opt.Password.RequireDigit = false;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

// API: returnera 401/403 i stället för login-redirect.
builder.Services.ConfigureApplicationCookie(opt =>
{
    opt.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    opt.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await MittSchema.Api.Data.DbSeeder.SeedAsync(scope.ServiceProvider);
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

public partial class Program { }
