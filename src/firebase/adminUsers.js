import { FIREBASE_API_KEY } from "./config";
import { upsertUser } from "./admin";

/**
 * Create a new login for a teammate from the Admin Panel.
 *
 * Deliberately uses the raw Identity Toolkit REST endpoint instead of the
 * Firebase Auth SDK's createUserWithEmailAndPassword — that SDK call signs
 * the browser in as the newly created user, replacing the admin's own
 * session. The REST call creates the account server-side without touching
 * the admin's local auth state at all.
 */
export async function adminCreateUser({ name, email, password, role = "user" }) {
  const trimmedEmail = email.trim().toLowerCase();

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, password, returnSecureToken: true }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const code = data?.error?.message || "";
    if (code.startsWith("EMAIL_EXISTS"))   throw new Error("A user with this email already exists");
    if (code.startsWith("WEAK_PASSWORD"))  throw new Error("Password must be at least 6 characters");
    if (code.startsWith("INVALID_EMAIL"))  throw new Error("That email address looks invalid");
    throw new Error(code || "Failed to create user");
  }

  const uid = data.localId;
  await upsertUser(uid, {
    name: name.trim(),
    email: trimmedEmail,
    role,
    active: true,
    createdAt: new Date(),
  });

  return uid;
}
