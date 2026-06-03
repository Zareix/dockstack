import { ImageActions } from '#/components/images/image-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { listImages } from '#/lib/functions'
import { ensureSession } from '#/lib/functions/auth'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/images')({
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await ensureSession(queryClient)()
    if (!session) {
      throw redirect({
        to: '/auth/$path',
        params: { path: 'sign-in' },
        search: { redirectTo: location.href },
      })
    }
  },
  component: ImagesPage,
})

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

function ImagesPage() {
  const query = useQuery({
    queryKey: ['images'],
    queryFn: listImages,
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">Images</h1>
      <Table className="text-base">
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Created</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                Loading...
              </TableCell>
            </TableRow>
          )}
          {query.error && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-destructive">
                {query.error.message}
              </TableCell>
            </TableRow>
          )}
          {query.data?.map((img) => (
            <TableRow key={img.id}>
              <TableCell className="font-mono text-sm">
                {img.tags.length > 0 ? img.tags.join(', ') : '<none>'}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {img.id}
              </TableCell>
              <TableCell className="text-sm">{formatSize(img.size)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(img.created * 1000).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <ImageActions image={img} />
              </TableCell>
            </TableRow>
          ))}
          {query.data?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No images found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
