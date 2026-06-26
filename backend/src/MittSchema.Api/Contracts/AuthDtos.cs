namespace MittSchema.Api.Contracts;

public record LoginRequest(string Login, string Password);
public record LoginResponse(string DisplayName, string Role, bool MustChangePassword);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
