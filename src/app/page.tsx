
import { redirect } from 'next/navigation'

export default function RootPage() {
  // Redirect directly to the main app page since we are auto-logged in.
  redirect('/')
}
