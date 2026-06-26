using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using MittSchema.Api.Contracts;
using MittSchema.Api.Domain;

namespace MittSchema.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signIn;
    private readonly UserManager<ApplicationUser> _users;

    public AuthController(SignInManager<ApplicationUser> signIn, UserManager<ApplicationUser> users)
    {
        _signIn = signIn;
        _users = users;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var user = await _users.FindByNameAsync(req.Login);
        if (user is null) return Unauthorized();

        // lockoutOnFailure: false — brute-force-lockout avstängt för piloten (medvetet val).
        var result = await _signIn.PasswordSignInAsync(user, req.Password, isPersistent: true, lockoutOnFailure: false);
        if (!result.Succeeded) return Unauthorized();

        var roles = await _users.GetRolesAsync(user);
        return Ok(new LoginResponse(user.DisplayName, roles.FirstOrDefault() ?? "", user.MustChangePassword));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await _signIn.SignOutAsync();
        return NoContent();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var user = await _users.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var result = await _users.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        user.MustChangePassword = false;
        await _users.UpdateAsync(user);

        // ChangePasswordAsync roterar SecurityStamp → den gamla cookien förkastas av
        // SecurityStampValidator. Återutfärda cookien så sessionen överlever bytet.
        await _signIn.RefreshSignInAsync(user);
        return NoContent();
    }
}
