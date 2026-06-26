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

        // JSONB i Postgres. InMemory ignorerar kolumntypen, sa testerna paverkas inte.
        b.Entity<Schedule>().Property(s => s.Data).HasColumnType("jsonb");
        b.Entity<RequestEntity>().Property(r => r.Payload).HasColumnType("jsonb");

        b.Entity<ClientProfile>().HasIndex(c => c.UserId).IsUnique();
        b.Entity<ClientProfile>().HasIndex(c => c.HandlaggareId);
        b.Entity<Schedule>().HasIndex(s => s.ClientUserId).IsUnique();
        b.Entity<RequestEntity>().HasIndex(r => new { r.ClientUserId, r.Status });
    }
}
