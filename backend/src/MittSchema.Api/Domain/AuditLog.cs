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
