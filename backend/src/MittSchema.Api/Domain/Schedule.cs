namespace MittSchema.Api.Domain;

public class Schedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ClientUserId { get; set; } = "";   // FK -> AspNetUsers
    public string Data { get; set; } = "{}";          // JSONB: weekly/weeks/overrides/permissions/...
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
