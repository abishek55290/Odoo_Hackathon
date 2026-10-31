import bcrypt from "bcryptjs";
import crypto from "crypto";

describe("Auth & Security Unit Tests", () => {
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  it("enforces strong password policy (min 8 chars, uppercase, lowercase, digit, special char)", () => {
    // Valid passwords
    expect(PASSWORD_REGEX.test("Admin123!Safe")).toBe(true);
    expect(PASSWORD_REGEX.test("P@ssw0rd2026")).toBe(true);

    // Invalid passwords
    expect(PASSWORD_REGEX.test("short1!")).toBe(false); // < 8 chars
    expect(PASSWORD_REGEX.test("alllowercase1!")).toBe(false); // no uppercase
    expect(PASSWORD_REGEX.test("ALLUPPERCASE1!")).toBe(false); // no lowercase
    expect(PASSWORD_REGEX.test("NoSpecialChar123")).toBe(false); // no special char
    expect(PASSWORD_REGEX.test("NoDigits!Password")).toBe(false); // no digit
  });

  it("hashes passwords securely with bcrypt", async () => {
    const raw = "SuperSecret!999";
    const hash = await bcrypt.hash(raw, 10);
    expect(hash).not.toBe(raw);
    expect(await bcrypt.compare(raw, hash)).toBe(true);
    expect(await bcrypt.compare("WrongPassword", hash)).toBe(false);
  });

  it("normalizes emails to lowercase trimmed format", () => {
    const input = "  Admin.User@BrightLoop.IO  ";
    const normalized = input.trim().toLowerCase();
    expect(normalized).toBe("admin.user@brightloop.io");
  });

  it("generates and verifies 32-byte cryptographically secure reset tokens", () => {
    const token = crypto.randomBytes(32).toString("hex");
    expect(token.length).toBe(64); // 32 bytes hex encoded = 64 characters

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const rehashed = crypto.createHash("sha256").update(token).digest("hex");
    expect(hashed).toBe(rehashed);
    expect(hashed.length).toBe(64);
  });

  it("verifies RBAC role hierarchy", () => {
    type Role = "ADMIN" | "STAFF" | "CUSTOMER";
    const canManageStaff = (role: Role) => role === "ADMIN";
    const canCreatePlans = (role: Role) => role === "ADMIN" || role === "STAFF";
    const canAccessOwnPortalOnly = (role: Role) => role === "CUSTOMER";

    expect(canManageStaff("ADMIN")).toBe(true);
    expect(canManageStaff("STAFF")).toBe(false);
    expect(canManageStaff("CUSTOMER")).toBe(false);

    expect(canCreatePlans("ADMIN")).toBe(true);
    expect(canCreatePlans("STAFF")).toBe(true);
    expect(canCreatePlans("CUSTOMER")).toBe(false);

    expect(canAccessOwnPortalOnly("CUSTOMER")).toBe(true);
    expect(canAccessOwnPortalOnly("ADMIN")).toBe(false);
  });
});
