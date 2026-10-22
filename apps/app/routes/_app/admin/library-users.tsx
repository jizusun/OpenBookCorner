import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { MoreHorizontal, Trash2, MailPlus, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/library-users')({
  beforeLoad: ({ context }) => {
    const { role } = context.user
    if (role !== 'library_admin' && role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: LibraryUsersPage,
})

interface UserRow {
  userId: string
  name: string
  email: string
  role: string
  joinedAt: string
}

function LibraryUsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()

  const { data: users = [], isLoading } = useQuery(api.membership.adminUsers.queryOptions())

  // Delete dialog state
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null)
  const [confirmEmail, setConfirmEmail] = useState('')

  const remove = useMutation({
    ...api.membership.remove.mutationOptions(),
    onSuccess: () => {
      toast.success(t`User removed from this library.`)
      setPendingDelete(null)
      setConfirmEmail('')
      queryClient.invalidateQueries({ queryKey: ['membership', 'adminUsers'] })
    },
    onError: () => toast.error(t`Could not remove user.`),
  })

  function openDelete(u: UserRow) {
    setPendingDelete(u)
    setConfirmEmail('')
  }

  // DataTable columns matching shadcn-admin: name, email, role + ⋯ actions
  const columns: Column<UserRow>[] = [
    {
      id: 'name',
      header: <Trans>Name</Trans>,
      cell: (u) => u.name,
      sortable: true,
      sortValue: (u) => u.name,
    },
    {
      id: 'email',
      header: <Trans>Email</Trans>,
      cell: (u) => <span className="text-muted-foreground">{u.email}</span>,
      sortable: true,
      sortValue: (u) => u.email,
      muted: true,
    },
    {
      id: 'role',
      header: <Trans>Role</Trans>,
      cell: (u) => (
        <Badge variant={u.role === 'library_admin' ? 'default' : 'secondary'}>
          {u.role === 'library_admin' ? <Trans>Admin</Trans> : <Trans>Reader</Trans>}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: <Trans>Actions</Trans>,
      srHeader: true,
      hideable: false,
      // ⋯ row actions dropdown — matching shadcn-admin's DataTableRowActions
      cell: (u) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
              data-testid={`row-actions-${u.userId}`}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only"><Trans>Open menu</Trans></span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => openDelete(u)}
              data-testid={`remove-user-${u.userId}`}
            >
              <Trans>Remove</Trans>
              <span className="ml-auto"><Trash2 size={16} /></span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6">
      {/* Header — matching shadcn-admin's Users layout */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight"><Trans>User List</Trans></h1>
          <p className="text-muted-foreground">
            <Trans>Manage your library members and their roles here.</Trans>
          </p>
        </div>
        {/* Primary button — Invite User (our version of "Add User") */}
        <Button
          onClick={() => router.navigate({ to: '/admin/invites' })}
          data-testid="invite-user-btn"
        >
          <MailPlus size={18} />
          <Trans>Invite User</Trans>
        </Button>
      </div>

      {/* DataTable — same component used throughout the app */}
      <DataTable<UserRow>
        rows={users as UserRow[]}
        loading={isLoading}
        columns={columns}
        rowKey={(u) => u.userId}
        rowTestId={(u) => `user-row-${u.userId}`}
        testId="library-users"
        toolbar={{
          search: {
            keys: [(u) => u.name, (u) => u.email],
            placeholder: t`Search users…`,
          },
          faceted: [
            {
              columnId: 'role',
              label: <Trans>Role</Trans>,
              value: (u) => u.role,
              options: [
                { value: 'library_admin', label: <Trans>Admin</Trans> },
                { value: 'library_reader', label: <Trans>Reader</Trans> },
              ],
            },
          ],
        }}
        enableColumnVisibility
        empty={{
          icon: '👤',
          title: <Trans>No users yet</Trans>,
          description: <Trans>Invite people using an invite link. They'll appear here after joining.</Trans>,
        }}
      />

      {/* Delete confirmation — shadcn-admin style: type email to confirm */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) { setPendingDelete(null); setConfirmEmail('') } }}
      >
        <AlertDialogContent data-testid="remove-user-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              <AlertTriangle className="me-1 inline-block stroke-destructive" size={18} />
              {' '}<Trans>Remove User</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  <Trans>
                    Are you sure you want to remove{' '}
                    <span className="font-bold">{pendingDelete?.name}</span> from this library?
                    They will lose access immediately. This action cannot be undone.
                  </Trans>
                </p>
                <Label>
                  <Trans>Type their email to confirm:</Trans>
                  <Input
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={pendingDelete?.email ?? ''}
                    autoFocus
                    className="mt-1.5"
                    data-testid="confirm-remove-email"
                  />
                </Label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending || confirmEmail.trim() !== pendingDelete?.email}
              onClick={() => pendingDelete && remove.mutate({ userId: pendingDelete.userId })}
              data-testid="confirm-remove-user"
            >
              {remove.isPending ? <Trans>Removing…</Trans> : <Trans>Remove</Trans>}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
