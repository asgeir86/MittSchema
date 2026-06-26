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
