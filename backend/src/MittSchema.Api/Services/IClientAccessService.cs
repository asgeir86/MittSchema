using MittSchema.Api.Domain;

namespace MittSchema.Api.Services;

public interface IClientAccessService
{
    // Klienter som tillhör en given handläggare.
    Task<List<ClientProfile>> CaseloadAsync(string handlaggareId);

    // Returnerar klientprofilen ENDAST om handläggaren äger den; annars null.
    Task<ClientProfile?> GetForHandlaggareAsync(string handlaggareId, string clientUserId);
}
