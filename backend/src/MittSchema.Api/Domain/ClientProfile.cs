namespace MittSchema.Api.Domain;

public class ClientProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "";        // FK -> AspNetUsers (klientens inlogg)
    public string HandlaggareId { get; set; } = "";  // FK -> AspNetUsers (ansvarig handläggare)
    public string Name { get; set; } = "";
}
