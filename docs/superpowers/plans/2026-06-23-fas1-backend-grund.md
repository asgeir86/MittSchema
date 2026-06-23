# Fas 1 — Backend-grund: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lägg grunden för MittSchemas backend — ett ASP.NET Core Web API med PostgreSQL, handläggar-provisionerad inloggning, roll/användarmodell och bevisad dataisolering mellan klienter och handläggare.

**Architecture:** Monorepo: backend i `backend/` (frontend-PWA:n ligger kvar i repo-roten och rörs inte i Fas 1). ASP.NET Core 8 Web API med controllers, EF Core + Npgsql, ASP.NET Core Identity med cookie-auth och två roller (`Handlaggare`, `Klient`). All dataåtkomst scopas i kod så att en klient bara når sitt eget och en handläggare bara sin egen caseload. Tester körs mot EF Core InMemory (ingen Docker krävs); riktig Postgres-integration skjuts till Fas 5-härdning.

**Tech Stack:** .NET 8, ASP.NET Core Web API (controllers), EF Core 8, Npgsql, ASP.NET Core Identity (cookie-auth), xUnit, Microsoft.AspNetCore.Mvc.Testing (`WebApplicationFactory`), FluentAssertions.

**Referensspec:** `docs/superpowers/specs/2026-06-23-pilotklar-mvp-design.md`

---

## Filstruktur (skapas i Fas 1)

```
backend/
  MittSchema.sln
  src/MittSchema.Api/
    MittSchema.Api.csproj
    Program.cs                     # bootstrap, DI, auth, seed
    Data/AppDbContext.cs           # EF Core-kontext (Identity + domän)
    Domain/ApplicationUser.cs      # IdentityUser + DisplayName, MustChangePassword
    Domain/Roles.cs                # rollkonstanter
    Domain/ClientProfile.cs        # klient i caseload (UserId, HandlaggareId, Name)
    Domain/Schedule.cs             # schema-JSONB per klient
    Domain/RequestEntity.cs        # förslag (Fas 2 fyller endpoints, tabellen finns nu)
    Domain/AuditLog.cs             # spårbarhet
    Domain/PushSubscription.cs     # web push (Fas 4 använder, tabellen finns nu)
    Services/IClientAccessService.cs
    Services/ClientAccessService.cs# scopad dataåtkomst (isoleringens kärna)
    Controllers/AuthController.cs  # login/logout/change-password
    Controllers/ClientsController.cs # caseload-läsning + provisionering
    Contracts/*.cs                 # request/response-DTO:er
    appsettings.json               # connection string via env, seed-handläggare
  tests/MittSchema.Api.Tests/
    MittSchema.Api.Tests.csproj
    ApiFactory.cs                  # WebApplicationFactory med InMemory-DB
    HealthTests.cs
    AuthTests.cs
    ProvisioningTests.cs
    IsolationTests.cs
```

---

## Task 0: Förkrav och solution-skelett

**Files:**
- Create: `backend/MittSchema.sln`
- Create: `backend/.gitignore`

- [ ] **Step 1: Verifiera .NET 8 SDK**

Run: `dotnet --version`
Expected: `8.0.x` (eller senare 8-serie). Om saknas: installera .NET 8 SDK innan du fortsätter.

- [ ] **Step 2: Skapa solution och projektmappar**

Run:
```bash
mkdir -p backend/src backend/tests
cd backend
dotnet new sln -n MittSchema
dotnet new webapi --use-controllers -n MittSchema.Api -o src/MittSchema.Api
dotnet new xunit -n MittSchema.Api.Tests -o tests/MittSchema.Api.Tests
dotnet sln add src/MittSchema.Api/MittSchema.Api.csproj
dotnet sln add tests/MittSchema.Api.Tests/MittSchema.Api.Tests.csproj
dotnet add tests/MittSchema.Api.Tests/MittSchema.Api.Tests.csproj reference src/MittSchema.Api/MittSchema.Api.csproj
```

- [ ] **Step 3: Lägg .NET-gitignore**

Create `backend/.gitignore`:
```gitignore
bin/
obj/
*.user
appsettings.Development.local.json
```

- [ ] **Step 4: Verifiera att allt bygger**

Run: `cd backend && dotnet build`
Expected: `Build succeeded` med 0 errors.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Fas 1: solution-skelett (Web API + xUnit-testprojekt)"
```

---

## Task 1: Health-endpoint + testharness

Etablerar `WebApplicationFactory`-harnessen som alla senare integrationstester använder. Rensa bort mallens `WeatherForecast`.

**Files:**
- Modify: `backend/src/MittSchema.Api/Program.cs`
- Delete: `backend/src/MittSchema.Api/Controllers/WeatherForecastController.cs`, `backend/src/MittSchema.Api/WeatherForecast.cs`
- Create: `backend/tests/MittSchema.Api.Tests/ApiFactory.cs`
- Create: `backend/tests/MittSchema.Api.Tests/HealthTests.cs`

- [ ] **Step 1: Ta bort mallfiler**

Run:
```bash
cd backend
rm src/MittSchema.Api/Controllers/WeatherForecastController.cs src/MittSchema.Api/WeatherForecast.cs
```

- [ ] **Step 2: Skriv Program.cs med health-endpoint och testbar Program-klass**

Replace `backend/src/MittSchema.Api/Program.cs` with:
```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

// Gör Program synlig för WebApplicationFactory i testprojektet.
public partial class Program { }
```

- [ ] **Step 3: Lägg testberoenden**

Run:
```bash
cd backend
dotnet add tests/MittSchema.Api.Tests/MittSchema.Api.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing
dotnet add tests/MittSchema.Api.Tests/MittSchema.Api.Tests.csproj package FluentAssertions
```

- [ ] **Step 4: Skriv ApiFactory (delas av alla tester; DB läggs till i Task 2)**

Create `backend/tests/MittSchema.Api.Tests/ApiFactory.cs`:
```csharp
using Microsoft.AspNetCore.Mvc.Testing;

namespace MittSchema.Api.Tests;

// Basfabrik. Utökas i Task 2 för att byta DB till InMemory.
public class ApiFactory : WebApplicationFactory<Program>
{
}
```

- [ ] **Step 5: Skriv health-testet**

Create `backend/tests/MittSchema.Api.Tests/HealthTests.cs`:
```csharp
using System.Net;
using FluentAssertions;
using Xunit;

namespace MittSchema.Api.Tests;

public class HealthTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public HealthTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Health_returns_ok()
    {
        var client = _factory.CreateClient();
        var res = await client.GetAsync("/health");
        res.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

- [ ] **Step 6: Kör testet**

Run: `cd backend && dotnet test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "Fas 1: health-endpoint + WebApplicationFactory-testharness"
```

---

## Task 2: EF Core + Identity + DbContext

**Files:**
- Modify: `backend/src/MittSchema.Api/MittSchema.Api.csproj` (paket)
- Create: `backend/src/MittSchema.Api/Domain/ApplicationUser.cs`
- Create: `backend/src/MittSchema.Api/Domain/Roles.cs`
- Create: `backend/src/MittSchema.Api/Data/AppDbContext.cs`
- Modify: `backend/src/MittSchema.Api/Program.cs`
- Modify: `backend/src/MittSchema.Api/appsettings.json`
- Modify: `backend/tests/MittSchema.Api.Tests/ApiFactory.cs`

- [ ] **Step 1: Lägg EF Core / Identity / Npgsql-paket**

Run:
```bash
cd backend
dotnet add src/MittSchema.Api package Microsoft.EntityFrameworkCore
dotnet add src/MittSchema.Api package Microsoft.EntityFrameworkCore.Design
dotnet add src/MittSchema.Api package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add src/MittSchema.Api package Microsoft.AspNetCore.Identity.EntityFrameworkCore
dotnet add tests/MittSchema.Api.Tests package Microsoft.EntityFrameworkCore.InMemory
```

- [ ] **Step 2: Skapa ApplicationUser och rollkonstanter**

Create `backend/src/MittSchema.Api/Domain/ApplicationUser.cs`:
```csharp
using Microsoft.AspNetCore.Identity;

namespace MittSchema.Api.Domain;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public bool MustChangePassword { get; set; }
}
```

Create `backend/src/MittSchema.Api/Domain/Roles.cs`:
```csharp
namespace MittSchema.Api.Domain;

public static class Roles
{
    public const string Handlaggare = "Handlaggare";
    public const string Klient = "Klient";
}
```

- [ ] **Step 3: Skapa AppDbContext (Identity-bas; domäntabeller läggs i Task 3)**

Create `backend/src/MittSchema.Api/Data/AppDbContext.cs`:
```csharp
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
}
```

- [ ] **Step 4: Wire upp DB + Identity i Program.cs**

Replace `backend/src/MittSchema.Api/Program.cs` with:
```csharp
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MittSchema.Api.Data;
using MittSchema.Api.Domain;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// DB: Postgres i drift. Testprojektet ersätter denna registrering med InMemory.
var conn = builder.Configuration.GetConnectionString("Default");
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(conn));

builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(opt =>
    {
        opt.Password.RequiredLength = 8;
        opt.User.RequireUniqueEmail = false;
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

public partial class Program { }
```

- [ ] **Step 5: Lägg connection string + seed-konfig i appsettings.json**

Replace `backend/src/MittSchema.Api/appsettings.json` with:
```json
{
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=mittschema;Username=postgres;Password=postgres"
  },
  "SeedHandlaggare": {
    "Login": "handlaggare@demo.local",
    "DisplayName": "Demo Handläggare",
    "Password": "Handlaggare#1"
  }
}
```

> Drift: connection string och seed-lösenord ska komma från miljövariabler/secret store, inte checkas in. Detta är pilot-defaults för lokal körning.

- [ ] **Step 6: Byt DB till InMemory i ApiFactory**

Replace `backend/tests/MittSchema.Api.Tests/ApiFactory.cs`:
```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MittSchema.Api.Data;

namespace MittSchema.Api.Tests;

public class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Ta bort den Npgsql-registrerade kontexten och dess options.
            var toRemove = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                d.ServiceType == typeof(AppDbContext)).ToList();
            foreach (var d in toRemove) services.Remove(d);

            services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase("mittschema-tests"));
        });
    }
}
```

- [ ] **Step 7: Verifiera att health-testet fortfarande passerar med DB inkopplad**

Run: `cd backend && dotnet test`
Expected: 1 passing test (health). Inga DB-fel vid uppstart.

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "Fas 1: EF Core + Identity + DbContext (Postgres i drift, InMemory i test)"
```

---

## Task 3: Domänentiteter + migration

**Files:**
- Create: `backend/src/MittSchema.Api/Domain/ClientProfile.cs`
- Create: `backend/src/MittSchema.Api/Domain/Schedule.cs`
- Create: `backend/src/MittSchema.Api/Domain/RequestEntity.cs`
- Create: `backend/src/MittSchema.Api/Domain/AuditLog.cs`
- Create: `backend/src/MittSchema.Api/Domain/PushSubscription.cs`
- Modify: `backend/src/MittSchema.Api/Data/AppDbContext.cs`

- [ ] **Step 1: Skapa entiteterna**

Create `backend/src/MittSchema.Api/Domain/ClientProfile.cs`:
```csharp
namespace MittSchema.Api.Domain;

public class ClientProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "";        // FK -> AspNetUsers (klientens inlogg)
    public string HandlaggareId { get; set; } = "";  // FK -> AspNetUsers (ansvarig handläggare)
    public string Name { get; set; } = "";
}
```

Create `backend/src/MittSchema.Api/Domain/Schedule.cs`:
```csharp
namespace MittSchema.Api.Domain;

public class Schedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ClientUserId { get; set; } = "";   // FK -> AspNetUsers
    public string Data { get; set; } = "{}";          // JSONB: weekly/weeks/overrides/permissions/...
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

Create `backend/src/MittSchema.Api/Domain/RequestEntity.cs`:
```csharp
namespace MittSchema.Api.Domain;

public class RequestEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ClientUserId { get; set; } = "";
    public string Type { get; set; } = "";    // "change" | "permission"
    public string Status { get; set; } = "pending"; // pending | approved | denied
    public string Payload { get; set; } = "{}"; // JSONB
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedAt { get; set; }
    public string? DecidedBy { get; set; }
}
```

Create `backend/src/MittSchema.Api/Domain/AuditLog.cs`:
```csharp
namespace MittSchema.Api.Domain;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ClientUserId { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string Role { get; set; } = "";
    public string Action { get; set; } = "";
    public string Detail { get; set; } = "";
    public DateTime Ts { get; set; } = DateTime.UtcNow;
}
```

Create `backend/src/MittSchema.Api/Domain/PushSubscription.cs`:
```csharp
namespace MittSchema.Api.Domain;

public class PushSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "";
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
}
```

- [ ] **Step 2: Lägg DbSets + JSONB-kolumntyper i AppDbContext**

Replace `backend/src/MittSchema.Api/Data/AppDbContext.cs`:
```csharp
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<ClientProfile> ClientProfiles => Set<ClientProfile>();
    public DbSet<Schedule> Schedules => Set<Schedule>();
    public DbSet<RequestEntity> Requests => Set<RequestEntity>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // JSONB i Postgres. InMemory ignorerar kolumntypen, så testerna påverkas inte.
        b.Entity<Schedule>().Property(s => s.Data).HasColumnType("jsonb");
        b.Entity<RequestEntity>().Property(r => r.Payload).HasColumnType("jsonb");

        b.Entity<ClientProfile>().HasIndex(c => c.UserId).IsUnique();
        b.Entity<ClientProfile>().HasIndex(c => c.HandlaggareId);
        b.Entity<Schedule>().HasIndex(s => s.ClientUserId).IsUnique();
        b.Entity<RequestEntity>().HasIndex(r => new { r.ClientUserId, r.Status });
    }
}
```

- [ ] **Step 3: Verifiera build**

Run: `cd backend && dotnet build`
Expected: `Build succeeded`.

- [ ] **Step 4: Installera EF-verktyg och skapa första migrationen**

Run:
```bash
cd backend
dotnet tool install --global dotnet-ef   # hoppa över om redan installerat
dotnet ef migrations add InitialCreate --project src/MittSchema.Api
```
Expected: en mapp `src/MittSchema.Api/Migrations/` med `*_InitialCreate.cs` skapas. (Migrationen genereras mot Npgsql-providern och behöver ingen körande databas för att *skapas*.)

- [ ] **Step 5: Kör testsviten (säkerställ att InMemory fortfarande startar)**

Run: `cd backend && dotnet test`
Expected: health-testet passerar.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Fas 1: domänentiteter (klient/schema/förslag/audit/push) + InitialCreate-migration"
```

---

## Task 4: Roll- och handläggar-seed

Vid uppstart ska rollerna finnas och en initial handläggare skapas (idempotent). Detta görs i en seed-rutin som körs både i drift och i testfabriken.

**Files:**
- Create: `backend/src/MittSchema.Api/Data/DbSeeder.cs`
- Modify: `backend/src/MittSchema.Api/Program.cs`
- Create: `backend/tests/MittSchema.Api.Tests/AuthTests.cs` (seed-verifiering här; login i Task 5)

- [ ] **Step 1: Skriv seedern**

Create `backend/src/MittSchema.Api/Data/DbSeeder.cs`:
```csharp
using Microsoft.AspNetCore.Identity;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        var roleMgr = sp.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { Roles.Handlaggare, Roles.Klient })
            if (!await roleMgr.RoleExistsAsync(role))
                await roleMgr.CreateAsync(new IdentityRole(role));

        var config = sp.GetRequiredService<IConfiguration>().GetSection("SeedHandlaggare");
        var login = config["Login"];
        if (string.IsNullOrWhiteSpace(login)) return;

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
            await userMgr.CreateAsync(user, config["Password"]!);
            await userMgr.AddToRoleAsync(user, Roles.Handlaggare);
        }
    }
}
```

- [ ] **Step 2: Kör seedern vid uppstart**

In `backend/src/MittSchema.Api/Program.cs`, insert immediately **after** `var app = builder.Build();`:
```csharp
using (var scope = app.Services.CreateScope())
{
    await MittSchema.Api.Data.DbSeeder.SeedAsync(scope.ServiceProvider);
}
```

- [ ] **Step 3: Skriv ett test som bevisar att seeden körts**

Create `backend/tests/MittSchema.Api.Tests/AuthTests.cs`:
```csharp
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
```

- [ ] **Step 4: Kör testerna**

Run: `cd backend && dotnet test`
Expected: 2 passing tests (health + seed).

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Fas 1: idempotent roll- och handläggar-seed + test"
```

---

## Task 5: Auth-endpoints (login / logout / change-password)

**Files:**
- Create: `backend/src/MittSchema.Api/Contracts/AuthDtos.cs`
- Create: `backend/src/MittSchema.Api/Controllers/AuthController.cs`
- Modify: `backend/tests/MittSchema.Api.Tests/AuthTests.cs`

- [ ] **Step 1: Skriv DTO:erna**

Create `backend/src/MittSchema.Api/Contracts/AuthDtos.cs`:
```csharp
namespace MittSchema.Api.Contracts;

public record LoginRequest(string Login, string Password);
public record LoginResponse(string DisplayName, string Role, bool MustChangePassword);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
```

- [ ] **Step 2: Skriv det failande login-testet**

Replace the body of `AuthTests` by adding these tests (behåll `Seed_creates_handlaggare_with_role`):
```csharp
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
```

Add the required usings at the top of `AuthTests.cs`:
```csharp
using System.Net.Http.Json;
using MittSchema.Api.Contracts;
```

- [ ] **Step 3: Kör testet och se det faila**

Run: `cd backend && dotnet test --filter Login_with_seeded_handlaggare_succeeds`
Expected: FAIL (404 — endpointen finns inte än).

- [ ] **Step 4: Skriv AuthController**

Create `backend/src/MittSchema.Api/Controllers/AuthController.cs`:
```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using MittSchema.Api.Contracts;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signIn;
    private readonly UserManager<ApplicationUser> _users;

    public AuthController(SignInManager<ApplicationUser> signIn, UserManager<ApplicationUser> users)
    {
        _signIn = signIn;
        _users = users;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var user = await _users.FindByNameAsync(req.Login);
        if (user is null) return Unauthorized();

        var result = await _signIn.PasswordSignInAsync(user, req.Password, isPersistent: true, lockoutOnFailure: false);
        if (!result.Succeeded) return Unauthorized();

        var roles = await _users.GetRolesAsync(user);
        return Ok(new LoginResponse(user.DisplayName, roles.FirstOrDefault() ?? "", user.MustChangePassword));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await _signIn.SignOutAsync();
        return NoContent();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var user = await _users.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var result = await _users.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        user.MustChangePassword = false;
        await _users.UpdateAsync(user);
        return NoContent();
    }
}
```

- [ ] **Step 5: Kör auth-testerna**

Run: `cd backend && dotnet test --filter AuthTests`
Expected: alla AuthTests passerar (seed + login OK + fel lösen 401).

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Fas 1: auth-endpoints (login/logout/change-password) + tester"
```

---

## Task 6: Klient-provisionering (handläggaren skapar klient → engångskod)

Handläggaren skapar en klient. Systemet genererar ett engångslösenord (= koden handläggaren delar), skapar Identity-användaren med rollen `Klient`, `MustChangePassword = true`, en `ClientProfile` kopplad till handläggaren, och ett tomt schema.

**Files:**
- Create: `backend/src/MittSchema.Api/Contracts/ClientDtos.cs`
- Create: `backend/src/MittSchema.Api/Controllers/ClientsController.cs`
- Create: `backend/tests/MittSchema.Api.Tests/ProvisioningTests.cs`
- Create: `backend/tests/MittSchema.Api.Tests/TestAuth.cs` (inloggnings-hjälpare)

- [ ] **Step 1: Skriv DTO:erna**

Create `backend/src/MittSchema.Api/Contracts/ClientDtos.cs`:
```csharp
namespace MittSchema.Api.Contracts;

public record CreateClientRequest(string Name);
public record CreateClientResponse(string ClientUserId, string Name, string Login, string OneTimeCode);
public record ClientSummary(string ClientUserId, string Name);
```

- [ ] **Step 2: Skriv inloggnings-hjälparen för tester**

Create `backend/tests/MittSchema.Api.Tests/TestAuth.cs`:
```csharp
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
```

> `WebApplicationFactory.CreateClient()` har en cookie-hanterare på som standard, så sessionscookien från login följer med på efterföljande anrop på samma `HttpClient`.

- [ ] **Step 3: Skriv det failande provisionerings-testet**

Create `backend/tests/MittSchema.Api.Tests/ProvisioningTests.cs`:
```csharp
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
}
```

- [ ] **Step 4: Kör testet och se det faila**

Run: `cd backend && dotnet test --filter ProvisioningTests`
Expected: FAIL (404/Unauthorized saknas — controllern finns inte).

- [ ] **Step 5: Skriv ClientsController (provisioneringsdelen)**

Create `backend/src/MittSchema.Api/Controllers/ClientsController.cs`:
```csharp
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
        var handlaggareId = _users.GetUserId(User)!;
        var login = $"klient-{Guid.NewGuid():N}".Substring(0, 14) + "@klient.local";
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
        await _users.AddToRoleAsync(user, Roles.Klient);

        _db.ClientProfiles.Add(new ClientProfile
        {
            UserId = user.Id,
            HandlaggareId = handlaggareId,
            Name = req.Name
        });
        _db.Schedules.Add(new Schedule { ClientUserId = user.Id, Data = "{}" });
        await _db.SaveChangesAsync();

        return Created($"/api/clients/{user.Id}",
            new CreateClientResponse(user.Id, req.Name, login, oneTimeCode));
    }

    // Engångskod: 10 tecken, lättläst (inga 0/O/1/I), uppfyller lösenordskraven.
    private static string GenerateCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        var bytes = RandomNumberGenerator.GetBytes(10);
        var chars = bytes.Select(b => alphabet[b % alphabet.Length]).ToArray();
        return "Ms" + new string(chars); // "Ms"-prefix garanterar versal+gemen+längd
    }
}
```

- [ ] **Step 6: Kör provisionerings-testerna**

Run: `cd backend && dotnet test --filter ProvisioningTests`
Expected: båda passerar (skapa klient + engångskod fungerar; anonym nekas 401).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "Fas 1: klient-provisionering (handläggare skapar klient + engångskod) + tester"
```

---

## Task 7: Caseload-läsning + dataisolering

Caseload-endpoints + bevisad isolering: en handläggare ser bara sina egna klienter; en klient (eller annan handläggare) nekas åtkomst till en klient utanför sin behörighet. Isoleringen ligger i en scopad service så att den kan återanvändas av alla framtida klient-endpoints.

**Files:**
- Create: `backend/src/MittSchema.Api/Services/IClientAccessService.cs`
- Create: `backend/src/MittSchema.Api/Services/ClientAccessService.cs`
- Modify: `backend/src/MittSchema.Api/Program.cs` (registrera servicen)
- Modify: `backend/src/MittSchema.Api/Controllers/ClientsController.cs` (GET-endpoints)
- Create: `backend/tests/MittSchema.Api.Tests/IsolationTests.cs`

- [ ] **Step 1: Definiera service-interfacet**

Create `backend/src/MittSchema.Api/Services/IClientAccessService.cs`:
```csharp
using MittSchema.Api.Domain;

namespace MittSchema.Api.Services;

public interface IClientAccessService
{
    // Klienter som tillhör en given handläggare.
    Task<List<ClientProfile>> CaseloadAsync(string handlaggareId);

    // Returnerar klientprofilen ENDAST om handläggaren äger den; annars null.
    Task<ClientProfile?> GetForHandlaggareAsync(string handlaggareId, string clientUserId);
}
```

- [ ] **Step 2: Implementera servicen**

Create `backend/src/MittSchema.Api/Services/ClientAccessService.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using MittSchema.Api.Data;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Services;

public class ClientAccessService : IClientAccessService
{
    private readonly AppDbContext _db;
    public ClientAccessService(AppDbContext db) => _db = db;

    public Task<List<ClientProfile>> CaseloadAsync(string handlaggareId) =>
        _db.ClientProfiles.Where(c => c.HandlaggareId == handlaggareId)
                          .OrderBy(c => c.Name).ToListAsync();

    public Task<ClientProfile?> GetForHandlaggareAsync(string handlaggareId, string clientUserId) =>
        _db.ClientProfiles.FirstOrDefaultAsync(
            c => c.HandlaggareId == handlaggareId && c.UserId == clientUserId);
}
```

- [ ] **Step 3: Registrera servicen i Program.cs**

In `backend/src/MittSchema.Api/Program.cs`, add **before** `var app = builder.Build();`:
```csharp
builder.Services.AddScoped<MittSchema.Api.Services.IClientAccessService, MittSchema.Api.Services.ClientAccessService>();
```

- [ ] **Step 4: Skriv de failande isoleringstesterna**

Create `backend/tests/MittSchema.Api.Tests/IsolationTests.cs`:
```csharp
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
```

- [ ] **Step 5: Kör testerna och se dem faila**

Run: `cd backend && dotnet test --filter IsolationTests`
Expected: FAIL (GET-endpoints finns inte än).

- [ ] **Step 6: Lägg GET-endpoints i ClientsController**

Add these members inside `ClientsController` (kräver att `IClientAccessService` injiceras). Replace the constructor and add the field + endpoints:
```csharp
    private readonly IClientAccessService _access;

    public ClientsController(UserManager<ApplicationUser> users, AppDbContext db, IClientAccessService access)
    {
        _users = users;
        _db = db;
        _access = access;
    }

    [HttpGet]
    public async Task<IActionResult> Caseload()
    {
        var handlaggareId = _users.GetUserId(User)!;
        var clients = await _access.CaseloadAsync(handlaggareId);
        return Ok(clients.Select(c => new ClientSummary(c.UserId, c.Name)));
    }

    [HttpGet("{clientUserId}")]
    public async Task<IActionResult> GetOne(string clientUserId)
    {
        var handlaggareId = _users.GetUserId(User)!;
        var profile = await _access.GetForHandlaggareAsync(handlaggareId, clientUserId);
        if (profile is null) return NotFound();
        return Ok(new ClientSummary(profile.UserId, profile.Name));
    }
```

Add the using at the top of `ClientsController.cs`:
```csharp
using MittSchema.Api.Services;
```

- [ ] **Step 7: Kör hela testsviten**

Run: `cd backend && dotnet test`
Expected: alla tester passerar (health, seed, auth, provisioning, isolation).

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "Fas 1: caseload-läsning + dataisolering (scopad ClientAccessService) + tester"
```

---

## Självgranskning (utförd mot specen)

**Spec-täckning (Fas 1-raden: "projekt, DB-schema, auth handläggar-provisionerad, roll/användarmodell, dataisolering"):**
- Projekt/skelett → Task 0–1 ✓
- DB-schema (alla entiteter + migration) → Task 2–3 ✓
- Auth (login/logout/change-password, cookie, 401/403) → Task 5 ✓
- Roll/användarmodell (roller + seed-handläggare) → Task 4 ✓
- Handläggar-provisionerad inloggning (skapa klient + engångskod + tvingat lösenordsbyte) → Task 6 ✓
- Dataisolering (scopad service + bevisande tester) → Task 7 ✓

**Ej i Fas 1 (medvetet, ligger i senare faser):** schema-CRUD och förslagsflödets endpoints (Fas 2), notiser (Fas 4), frontend-omkoppling (Fas 3). Tabellerna för dessa skapas dock redan i Task 3 så migrationen är komplett.

**Placeholder-scan:** inga TBD/TODO; varje kodsteg innehåller fullständig kod.

**Typ-konsistens:** `LoginResponse`, `CreateClientResponse`, `ClientSummary`, `IClientAccessService.GetForHandlaggareAsync/CaseloadAsync` används med samma signaturer i controller och tester.

---

## Körinstruktion (för exekvering mot riktig Postgres)

Testerna kräver ingen databas (InMemory). För att köra själva API:t lokalt krävs en Postgres på
`localhost:5432` (eller justerad connection string) och att migrationen appliceras:
```bash
cd backend
dotnet ef database update --project src/MittSchema.Api
dotnet run --project src/MittSchema.Api
```
