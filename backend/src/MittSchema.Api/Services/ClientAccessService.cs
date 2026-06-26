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
