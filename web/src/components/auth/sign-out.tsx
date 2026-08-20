import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { useSession } from "#/lib/app-context"

import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"

export function SignOut() {
  const { logout } = useSession()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      toast.success("Signed out")
      navigate({ to: "/auth/$path", params: { path: "sign-in" } })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sign out</CardTitle>
        <CardDescription>Are you sure you want to sign out?</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
          Sign out
        </Button>
      </CardContent>
    </Card>
  )
}
