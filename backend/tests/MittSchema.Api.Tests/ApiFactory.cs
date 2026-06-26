using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MittSchema.Api.Data;

namespace MittSchema.Api.Tests;

public class ApiFactory : WebApplicationFactory<Program>
{
    // Unik per fabriksinstans sa att varje testklass far sin isolerade InMemory-databas,
    // men alla DbContext-instanser inom samma fabrik delar samma namngivna databas.
    private readonly string _dbName = $"mittschema-tests-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Ta bort ALLA AppDbContext-relaterade registreringar. EF Core 9+/10:s
            // AddDbContext registrerar inte bara DbContextOptions/kontexten utan även
            // en IDbContextOptionsConfiguration<AppDbContext> som bär Npgsql-providern.
            // Lämnas den kvar samexisterar Npgsql + InMemory när options byggs (seed/
            // DB-åtkomst i senare tasks) → "Only a single database provider"-fel.
            // Matchas på typnamn så vi slipper referera den interna typen direkt.
            var toRemove = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                d.ServiceType == typeof(DbContextOptions) ||
                d.ServiceType == typeof(AppDbContext) ||
                (d.ServiceType.IsGenericType &&
                 d.ServiceType.GetGenericTypeDefinition().Name.Contains("DbContextOptionsConfiguration") &&
                 d.ServiceType.GenericTypeArguments.Contains(typeof(AppDbContext)))).ToList();
            foreach (var d in toRemove) services.Remove(d);

            services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase(_dbName));
        });
    }
}
