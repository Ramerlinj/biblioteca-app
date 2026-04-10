import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Heart,
  BookOpen,
  Calendar,
  Building,
  Hash,
  Tag,
} from "lucide-react";
import { Books, type Book } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { ContentLoading } from "@/components/LoadingState";

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canManageBook =
    !!user && !!book && user.id === book.userId && user.role !== "usuario";

  useEffect(() => {
    if (!user) {
      setBook(null);
      setIsLoading(false);
      return;
    }

    const currentUser = user;

    let ignore = false;

    async function loadBook() {
      setIsLoading(true);
      const nextBook = await Books.get(params.id, currentUser.id);

      if (!ignore) {
        setBook(nextBook);
        setIsLoading(false);
      }
    }

    void loadBook();

    return () => {
      ignore = true;
    };
  }, [params.id, user]);

  async function handleDelete() {
    if (!user) return;
    await Books.delete(params.id, user.id);
    toast({ title: "Libro eliminado" });
    setLocation("/");
  }

  async function handleFavorite() {
    if (!user || !book) return;
    const updated = await Books.toggleFavorite(book.id, user.id);
    if (updated) {
      setBook(updated);
    }
  }

  if (isLoading) {
    return <ContentLoading label="Cargando libro" />;
  }

  if (!book) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Libro no encontrado.</p>
        <Link
          href="/"
          className="text-primary text-sm mt-2 inline-block hover:underline"
        >
          Volver a la biblioteca
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href="/"
        data-testid="link-back"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la biblioteca
      </Link>

      <div className="flex flex-col md:flex-row gap-10">
        <div className="shrink-0 w-full md:w-52">
          <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-2/3 bg-muted">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-primary to-green-800 flex flex-col items-center justify-center">
                <BookOpen className="h-12 w-12 text-white/70 mb-2" />
                <span className="text-white/80 text-sm font-medium">
                  {book.genre}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            {canManageBook ? (
              <Button
                data-testid="button-favorite"
                variant="outline"
                className={cn(
                  "flex-1 gap-1.5",
                  book.isFavorite &&
                    "border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100",
                )}
                onClick={() => void handleFavorite()}
              >
                <Heart
                  className={cn("h-4 w-4", book.isFavorite && "fill-current")}
                />
                {book.isFavorite ? "Favorito" : "Añadir"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1
                data-testid="text-book-title"
                className="text-3xl font-serif font-semibold text-foreground mb-1"
              >
                {book.title}
              </h1>
              <p className="text-lg text-muted-foreground">{book.author}</p>
            </div>
            {canManageBook ? (
              <div className="flex gap-2 shrink-0">
                <Link href={`/books/${book.id}/edit`} data-testid="link-edit">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    asChild={false}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </Link>
                <Button
                  data-testid="button-delete"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10"
            >
              <Tag className="h-3 w-3 mr-1" />
              {book.genre}
            </Badge>
            {book.year && (
              <Badge variant="outline">
                <Calendar className="h-3 w-3 mr-1" />
                {book.year}
              </Badge>
            )}
            {book.editorial && (
              <Badge variant="outline">
                <Building className="h-3 w-3 mr-1" />
                {book.editorial}
              </Badge>
            )}
            {book.isbn && (
              <Badge variant="outline">
                <Hash className="h-3 w-3 mr-1" />
                ISBN: {book.isbn}
              </Badge>
            )}
          </div>

          {book.description && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">
                Descripción
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {book.description}
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t border-border pt-4">
            Añadido el{" "}
            {new Date(book.createdAt).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      <Dialog
        open={showDeleteModal && canManageBook}
        onOpenChange={setShowDeleteModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar libro</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar "{book.title}"? Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              data-testid="button-confirm-delete"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
