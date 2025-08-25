// src/app/(app)/admin/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import { User } from "@/lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function getAdminData() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/unauthorized");
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userSnap = await adminDB.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      redirect("/unauthorized");
    }

    const userData = userSnap.data() as User;
    const isAdmin = userData?.role === "Admin";

    if (!isAdmin) {
      redirect("/unauthorized");
    }

    // Fetch any other admin-specific data here
    const allUsersSnap = await adminDB.collection("users").get();
    const allUsers = allUsersSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as User)
    );

    return { user: userData, allUsers };
  } catch (err) {
    console.error("Admin check failed:", err);
    redirect("/unauthorized");
  }
}

export default async function AdminSettings() {
  const { user, allUsers } = await getAdminData();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🔐 Admin Dashboard</CardTitle>
          <CardDescription>
            This page is protected by server-side authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Welcome, <span className="font-semibold">{user.name}</span>! You
            have admin privileges.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Total users in the system: {allUsers.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul>
            {allUsers.map((u) => (
              <li key={u.id}>
                {u.name} ({u.email}) - {u.role}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
