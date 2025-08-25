// Unified navigation: redirect to single dashboard instance
import { redirect } from "next/navigation";

export default function MyTasksRedirect() {
  redirect("/?view=mytasks");
}
