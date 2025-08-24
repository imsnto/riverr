import { redirect } from "next/navigation";

// Redirect legacy /documents route to unified dashboard with documents view
export default function DocumentsRedirect() {
  redirect("/?view=documents");
}
