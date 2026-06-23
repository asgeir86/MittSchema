using Microsoft.AspNetCore.Identity;

namespace MittSchema.Api.Domain;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public bool MustChangePassword { get; set; }
}
