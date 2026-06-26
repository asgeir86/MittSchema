namespace MittSchema.Api.Contracts;

public record CreateClientRequest(string Name);
public record CreateClientResponse(string ClientUserId, string Name, string Login, string OneTimeCode);
public record ClientSummary(string ClientUserId, string Name);
