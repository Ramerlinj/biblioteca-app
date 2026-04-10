import { Heart, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Books, type Book } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";

const GENRE_COLORS: Record<string, string> = {
  Ficción: "from-emerald-600 to-green-700",
  "No ficción": "from-slate-600 to-gray-700",
  "Ciencia ficción": "from-indigo-600 to-violet-700",
  Fantasía: "from-purple-600 to-violet-700",
  Romance: "from-rose-500 to-pink-600",
  Thriller: "from-red-700 to-rose-800",
  Historia: "from-amber-600 to-yellow-700",
  Biografía: "from-teal-600 to-cyan-700",
  Autoayuda: "from-orange-500 to-amber-600",
  Poesía: "from-pink-500 to-rose-600",
};

export function BookCard({
  book,
  onFavoriteToggle,
}: {
  book: Book;
  onFavoriteToggle?: () => void;
}) {
  const { user } = useAuth();
  const canManageBook = user?.id === book.userId && user.role !== "usuario";

  async function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !canManageBook) {
      return;
    }

    await Books.toggleFavorite(book.id, user.id);
    onFavoriteToggle?.();
  }

  const gradientClass =
    GENRE_COLORS[book.genre] ?? "from-green-700 to-emerald-800";

  return (
    <Link href={`/books/${book.id}`}>
      <a
        data-testid={`card-book-${book.id}`}
        className="group block cursor-pointer"
      >
        <div className="relative overflow-hidden rounded-xl shadow-sm border border-card-border bg-card transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1">
          <div className="relative aspect-2/3 overflow-hidden">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (
                    e.target as HTMLImageElement
                  ).nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div
              className={cn(
                "w-full h-full bg-linear-to-br flex flex-col items-center justify-center p-4",
                book.coverUrl ? "hidden" : "",
                gradientClass,
              )}
            >
              <BookOpen className="h-10 w-10 text-white/70 mb-2" />
              <span className="text-white/90 text-xs font-medium text-center line-clamp-3 leading-tight">
                {book.genre}
              </span>
            </div>

            {canManageBook ? (
              <button
                onClick={(e) => void handleFavorite(e)}
                data-testid={`button-favorite-${book.id}`}
                className={cn(
                  "absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-all duration-200",
                  book.isFavorite
                    ? "bg-rose-500/90 text-white"
                    : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white",
                )}
              >
                <Heart
                  className={cn(
                    "h-3.5 w-3.5",
                    book.isFavorite && "fill-current",
                  )}
                />
              </button>
            ) : null}
          </div>

          <div className="p-3">
            <h3
              data-testid={`text-book-title-${book.id}`}
              className="font-semibold text-sm text-card-foreground line-clamp-1 leading-tight mb-0.5"
            >
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {book.author}
            </p>
            {book.year && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {book.year}
              </p>
            )}
          </div>
        </div>
      </a>
    </Link>
  );
}
