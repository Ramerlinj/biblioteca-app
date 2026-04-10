import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Shield,
  Trash2,
  Users as UsersIcon,
  UserPlus,
} from "lucide-react";
import { Users, type DirectoryUser, type UserRole } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ContentLoading } from "@/components/LoadingState";

const schema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  role: z.enum(["usuario", "admin", "superadmin"]),
});

type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "No tienes permisos para gestionar usuarios con las reglas actuales de Firestore.";
  }

  if (code === "firestore/offline") {
    return "No hay conexión a internet.";
  }

  if (code === "firestore/timeout") {
    return "Firebase tardó demasiado en responder.";
  }

  return "Inténtalo de nuevo en unos segundos.";
}

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DirectoryUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const currentRole = user?.role ?? "usuario";
  const isSuperAdmin = currentRole === "superadmin";
  const isAdmin = currentRole === "admin";
  const canManageUsers = isSuperAdmin || isAdmin;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "usuario",
    },
  });

  async function loadUsers() {
    setIsLoading(true);
    try {
      const nextUsers = await Users.list();
      setUsers(nextUsers);
    } catch (error) {
      toast({
        title: "No se pudieron cargar los usuarios",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!canManageUsers) {
      setIsLoading(false);
      return;
    }

    void loadUsers();
  }, [canManageUsers]);

  const editingUser = useMemo(
    () => users.find((item) => item.id === editingUserId) ?? null,
    [users, editingUserId],
  );

  function openCreateModal() {
    setEditingUserId(null);
    setShowPassword(false);
    form.reset({ name: "", email: "", password: "", role: "usuario" });
    setIsCreateModalOpen(true);
  }

  function openEditModal(target: DirectoryUser) {
    setEditingUserId(target.id);
    setShowPassword(false);
    form.reset({
      name: target.name,
      email: target.email,
      password: "",
      role: target.role,
    });
    setIsEditModalOpen(true);
  }

  async function onSubmit(values: FormValues) {
    if (!canManageUsers) {
      toast({
        title: "No tienes permisos para gestionar usuarios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingUserId) {
        const payload = {
          name: values.name,
          email: values.email,
          ...(isSuperAdmin ? { role: values.role } : {}),
        };

        const updated = await Users.update(editingUserId, payload);
        if (!updated) {
          toast({ title: "El usuario ya no existe", variant: "destructive" });
          return;
        }

        setUsers((prev) =>
          prev
            .map((item) => (item.id === editingUserId ? updated : item))
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
        );

        toast({ title: "Usuario actualizado" });
        setIsEditModalOpen(false);
        setEditingUserId(null);
        return;
      }

      const password = (values.password ?? "").trim();
      if (password.length < 6) {
        form.setError("password", {
          type: "manual",
          message: "Mínimo 6 caracteres",
        });
        return;
      }

      const role: UserRole = isSuperAdmin ? values.role : "usuario";

      const created = await Users.create({
        name: values.name,
        email: values.email,
        password,
        role,
      });
      setUsers((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
      form.reset({ name: "", email: "", password: "", role: "usuario" });
      toast({ title: "Usuario creado" });
      setIsCreateModalOpen(false);
    } catch (error) {
      toast({
        title: editingUserId
          ? "No se pudo actualizar el usuario"
          : "No se pudo crear el usuario",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  }

  async function handleDelete(target: DirectoryUser) {
    if (user && target.id === user.id) {
      toast({
        title: "No puedes eliminar tu propio perfil activo",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDeleting(true);
      const removed = await Users.delete(target.id);
      if (!removed) {
        toast({ title: "El usuario ya no existe", variant: "destructive" });
        return;
      }

      setUsers((prev) => prev.filter((item) => item.id !== target.id));
      if (editingUserId === target.id) {
        setEditingUserId(null);
      }
      setDeleteTarget(null);
      toast({ title: "Usuario eliminado" });
    } catch (error) {
      toast({
        title: "No se pudo eliminar el usuario",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return <ContentLoading label="Cargando usuarios" />;
  }

  if (!canManageUsers) {
    return (
      <div className="p-8">
        <div className="max-w-2xl rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-2xl font-serif font-semibold text-foreground mb-2">
            Acceso restringido
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta sección solo está disponible para administradores.
          </p>
        </div>
      </div>
    );
  }

  function roleBadge(role: UserRole) {
    if (role === "superadmin") {
      return (
        <Badge className="bg-rose-500 text-white border-rose-500">
          Superadmin
        </Badge>
      );
    }
    if (role === "admin") {
      return (
        <Badge className="bg-amber-500 text-white border-amber-500">
          Admin
        </Badge>
      );
    }
    return <Badge variant="secondary">Usuario</Badge>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground mb-1">
            Usuarios
          </h1>
          <p className="text-muted-foreground">
            {users.length} usuarios en el directorio
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Agregar usuario
        </Button>
      </div>

      {!isSuperAdmin ? (
        <div className="mb-6 rounded-xl border border-amber-300/40 bg-amber-100/10 p-4">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 mt-0.5" />
            Como admin, solo puedes crear usuarios con rol "usuario" y no puedes
            cambiar roles.
          </p>
        </div>
      ) : null}

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-card-border flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Listado de usuarios
          </h2>
        </div>

        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-card-border bg-muted/30">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Nombre
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Rol
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Alta
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="border-b border-card-border/70">
                    <td className="px-4 py-3 text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.email}
                    </td>
                    <td className="px-4 py-3">{roleBadge(item.role)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground text-center">
            No hay usuarios registrados en el directorio.
          </p>
        )}
      </div>

      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open) {
            setEditingUserId(null);
            form.reset({ name: "", email: "", password: "", role: "usuario" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogDescription>
              Completa los datos para crear una cuenta nueva.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Minimo 6 caracteres"
                          className="pl-9 pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword((current) => !current)}
                          aria-label={
                            showPassword
                              ? "Ocultar contrasena"
                              : "Mostrar contrasena"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!isSuperAdmin}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="usuario">Usuario</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="superadmin">Superadmin</SelectItem>
                      </SelectContent>
                    </Select>
                    {!isSuperAdmin ? (
                      <p className="text-xs text-muted-foreground">
                        Solo superadmin puede asignar rol.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="gap-1.5"
                  disabled={form.formState.isSubmitting}
                >
                  <UserPlus className="h-4 w-4" />
                  Crear usuario
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            setEditingUserId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Actualiza la informacion del usuario seleccionado.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!isSuperAdmin}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="usuario">Usuario</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="superadmin">Superadmin</SelectItem>
                      </SelectContent>
                    </Select>
                    {!isSuperAdmin ? (
                      <p className="text-xs text-muted-foreground">
                        Solo superadmin puede cambiar roles.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="gap-1.5"
                  disabled={form.formState.isSubmitting || !editingUser}
                >
                  <Pencil className="h-4 w-4" />
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Vas a eliminar a ${deleteTarget.name}. Esta accion no se puede deshacer.`
                : "Esta accion no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) {
                  void handleDelete(deleteTarget);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
