import { db } from "#/db"
import { env } from "#/env"
import { auth } from "#/lib/auth"

export const seed = async () => {
  console.log("Seeding database...")

  const user = await db.query.user.findFirst()
  if (!user) {
    console.log("Creating admin user...")
    const res = await auth.api.createUser({
      body: {
        name: "Admin",
        email: env.ADMIN_EMAIL,
        password: "password",
        role: "admin",
        data: { username: "admin" },
      },
    })
    console.log(
      "Admin user created with id",
      res.user.id,
      "and email",
      res.user.email,
      "and default password is 'password'. Please change the password after logging in.",
    )
  }

  console.log("Database seeded")
}
