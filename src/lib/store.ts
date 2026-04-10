import {
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    type User as FirebaseUser,
} from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { auth, db, firebaseConfig } from "@/lib/firebase";

export type UserRole = "usuario" | "admin" | "superadmin";

export interface StoredUser {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    role: UserRole;
}

export interface Book {
    id: string;
    userId: string;
    title: string;
    author: string;
    genre: string;
    editorial?: string;
    year?: number;
    isbn?: string;
    description?: string;
    coverUrl?: string;
    isFavorite: boolean;
    createdAt: string;
}

export interface DirectoryUser {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    role: UserRole;
}

function normalizeRole(value: unknown): UserRole {
    if (value === "admin" || value === "superadmin" || value === "usuario") {
        return value;
    }
    return "usuario";
}

function toIsoDate(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
        return value.toDate().toISOString();
    }

    return new Date().toISOString();
}

function normalizeBook(id: string, data: Record<string, unknown>): Book {
    return {
        id,
        userId: String(data.userId ?? ""),
        title: String(data.title ?? ""),
        author: String(data.author ?? ""),
        genre: String(data.genre ?? ""),
        editorial: typeof data.editorial === "string" ? data.editorial : undefined,
        year: typeof data.year === "number" ? data.year : undefined,
        isbn: typeof data.isbn === "string" ? data.isbn : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
        coverUrl: typeof data.coverUrl === "string" ? data.coverUrl : undefined,
        isFavorite: Boolean(data.isFavorite),
        createdAt: toIsoDate(data.createdAt),
    };
}

function normalizeDirectoryUser(id: string, data: Record<string, unknown>): DirectoryUser {
    return {
        id,
        name: String(data.name ?? "Usuario"),
        email: String(data.email ?? ""),
        createdAt: toIsoDate(data.createdAt),
        role: normalizeRole(data.role),
    };
}

function mapFirebaseUserToStoredUser(firebaseUser: FirebaseUser): StoredUser {
    return {
        id: firebaseUser.uid,
        name: firebaseUser.displayName?.trim() || firebaseUser.email?.split("@")[0] || "Usuario",
        email: firebaseUser.email ?? "",
        createdAt: firebaseUser.metadata.creationTime
            ? new Date(firebaseUser.metadata.creationTime).toISOString()
            : new Date().toISOString(),
        role: "usuario",
    };
}

function isPermissionDeniedError(error: unknown): boolean {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    return code === "permission-denied" || code === "firestore/permission-denied";
}

async function resolveUserProfile(firebaseUser: FirebaseUser): Promise<StoredUser> {
    const userRef = doc(db, "users", firebaseUser.uid);
    let snapshot;
    try {
        snapshot = await getDoc(userRef);
    } catch (error) {
        if (isPermissionDeniedError(error)) {
            return mapFirebaseUserToStoredUser(firebaseUser);
        }
        throw error;
    }

    if (snapshot.exists()) {
        const data = snapshot.data();
        return {
            id: firebaseUser.uid,
            name: String(data.name ?? firebaseUser.displayName ?? "Usuario"),
            email: String(data.email ?? firebaseUser.email ?? ""),
            createdAt: toIsoDate(data.createdAt ?? firebaseUser.metadata.creationTime),
            role: normalizeRole(data.role),
        };
    }

    const fallbackName =
        firebaseUser.displayName?.trim() || firebaseUser.email?.split("@")[0] || "Usuario";
    const profile: StoredUser = {
        id: firebaseUser.uid,
        name: fallbackName,
        email: firebaseUser.email ?? "",
        createdAt: firebaseUser.metadata.creationTime
            ? new Date(firebaseUser.metadata.creationTime).toISOString()
            : new Date().toISOString(),
        role: "usuario",
    };

    try {
        await setDoc(
            userRef,
            {
                name: profile.name,
                email: profile.email,
                createdAt: profile.createdAt,
                role: profile.role,
            },
            { merge: true },
        );
    } catch (error) {
        if (!isPermissionDeniedError(error)) {
            throw error;
        }
    }

    return profile;
}

export const Auth = {
    async login(email: string, password: string): Promise<StoredUser | { error: string }> {
        try {
            const credentials = await signInWithEmailAndPassword(auth, email, password);
            return await resolveUserProfile(credentials.user);
        } catch (error) {
            const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

            if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
                return { error: "Credenciales incorrectas" };
            }

            if (code === "auth/too-many-requests") {
                return { error: "Demasiados intentos. Intenta de nuevo en unos minutos" };
            }

            if (code === "auth/configuration-not-found") {
                return { error: "Firebase Auth no está configurado en este proyecto" };
            }

            return { error: "No se pudo iniciar sesión" };
        }
    },

    async register(name: string, email: string, password: string): Promise<StoredUser | { error: string }> {
        try {
            const credentials = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(credentials.user, { displayName: name });

            const createdAt = credentials.user.metadata.creationTime
                ? new Date(credentials.user.metadata.creationTime).toISOString()
                : new Date().toISOString();

            const user: StoredUser = {
                id: credentials.user.uid,
                name,
                email,
                createdAt,
                role: "usuario",
            };

            try {
                await setDoc(doc(db, "users", user.id), {
                    name: user.name,
                    email: user.email,
                    createdAt: user.createdAt,
                    role: "usuario",
                });
            } catch (error) {
                if (!isPermissionDeniedError(error)) {
                    throw error;
                }
            }

            return user;
        } catch (error) {
            const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

            if (code === "auth/email-already-in-use") {
                return { error: "Este email ya está registrado" };
            }

            if (code === "auth/weak-password") {
                return { error: "La contraseña es demasiado débil" };
            }

            if (code === "auth/configuration-not-found") {
                return { error: "Firebase Auth no está configurado en este proyecto" };
            }

            return { error: "No se pudo crear la cuenta" };
        }
    },

    async getSession(): Promise<StoredUser | null> {
        if (!auth.currentUser) {
            return null;
        }

        return await resolveUserProfile(auth.currentUser);
    },

    onSessionChange(callback: (user: StoredUser | null) => void): () => void {
        return onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                callback(null);
                return;
            }

            // Entrega inmediata para no bloquear UI cuando Firestore está lento/offline.
            callback(mapFirebaseUserToStoredUser(firebaseUser));

            void (async () => {
                try {
                    const user = await resolveUserProfile(firebaseUser);
                    callback(user);
                } catch (error) {
                    console.warn("Firestore no disponible temporalmente para perfil; usando datos base de Auth");
                }
            })();
        });
    },

    async clearSession(): Promise<void> {
        await signOut(auth);
    },
};

export interface ListBooksOptions {
    search?: string;
    genre?: string;
    sort?: "az" | "za" | "newest" | "oldest";
    favorites?: boolean;
    userId?: string;
}

const FIRESTORE_READ_TIMEOUT_MS = 8000;
const FIRESTORE_WRITE_TIMEOUT_MS = 20000;
const BOOKS_CACHE_TTL_MS = 15_000;
const booksCache = new Map<string, { books: Book[]; fetchedAt: number }>();
const ALL_BOOKS_CACHE_KEY = "all";

function ensureOnlineForWrite(): void {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const error = new Error("No hay conexión a internet");
        (error as Error & { code?: string }).code = "firestore/offline";
        throw error;
    }
}

function isRecoverableFirestoreReadError(error: unknown): boolean {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return (
        code.includes("unavailable") ||
        code.includes("offline") ||
        code.includes("deadline-exceeded") ||
        message.includes("offline") ||
        message.includes("timeout")
    );
}

async function withTimeout<T>(promise: Promise<T>, ms = FIRESTORE_READ_TIMEOUT_MS): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error("Firestore timeout");
            (error as Error & { code?: string }).code = "firestore/timeout";
            reject(error);
        }, ms);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

function getCachedBooks(): Book[] | null {
    const entry = booksCache.get(ALL_BOOKS_CACHE_KEY);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > BOOKS_CACHE_TTL_MS) return null;
    return entry.books;
}

function setCachedBooks(books: Book[]): void {
    booksCache.set(ALL_BOOKS_CACHE_KEY, { books, fetchedAt: Date.now() });
}

function invalidateCachedBooks(): void {
    booksCache.delete(ALL_BOOKS_CACHE_KEY);
}

async function getAllBooks(): Promise<Book[]> {
    const cached = getCachedBooks();
    if (cached) {
        return cached;
    }

    try {
        const booksQuery = query(collection(db, "books"));
        const snapshot = await withTimeout(getDocs(booksQuery));
        const books = snapshot.docs.map((bookDoc) => normalizeBook(bookDoc.id, bookDoc.data()));
        setCachedBooks(books);
        return books;
    } catch (error) {
        if (isRecoverableFirestoreReadError(error)) {
            console.warn("Lectura de Firestore temporalmente no disponible; devolviendo lista local", error);
            return cached ?? [];
        }
        throw error;
    }
}

export const Books = {
    async list({ search, genre, sort = "newest", favorites }: ListBooksOptions): Promise<Book[]> {
        let books = await getAllBooks();

        if (genre && genre !== "all") {
            books = books.filter((book) => book.genre === genre);
        }

        if (favorites) {
            books = books.filter((book) => book.isFavorite);
        }

        if (search) {
            const q = search.toLowerCase();
            books = books.filter(
                (book) =>
                    book.title.toLowerCase().includes(q) ||
                    book.author.toLowerCase().includes(q) ||
                    book.genre.toLowerCase().includes(q),
            );
        }

        books.sort((a, b) => {
            if (sort === "az") return a.title.localeCompare(b.title);
            if (sort === "za") return b.title.localeCompare(a.title);
            if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return books;
    },

    async get(id: string, userId?: string): Promise<Book | null> {
        const cached = getCachedBooks();
        if (cached) {
            const fromCache = cached.find((book) => book.id === id) ?? null;
            if (fromCache) return fromCache;
        }

        let snapshot;
        try {
            snapshot = await withTimeout(getDoc(doc(db, "books", id)));
        } catch (error) {
            if (isRecoverableFirestoreReadError(error)) {
                console.warn("No se pudo leer detalle desde Firestore; devolviendo cache local", error);
                return cached?.find((book) => book.id === id) ?? null;
            }
            throw error;
        }

        if (!snapshot.exists()) {
            return null;
        }

        const book = normalizeBook(snapshot.id, snapshot.data());
        return book;
    },

    async create(userId: string, data: Omit<Book, "id" | "userId" | "isFavorite" | "createdAt">): Promise<Book> {
        ensureOnlineForWrite();

        const payload = {
            userId,
            title: data.title,
            author: data.author,
            genre: data.genre,
            editorial: data.editorial ?? null,
            year: data.year ?? null,
            isbn: data.isbn ?? null,
            description: data.description ?? null,
            coverUrl: data.coverUrl ?? null,
            isFavorite: false,
            createdAt: new Date().toISOString(),
        };

        const createdDoc = await withTimeout(addDoc(collection(db, "books"), payload), FIRESTORE_WRITE_TIMEOUT_MS);
        const createdBook = normalizeBook(createdDoc.id, payload);
        const cached = getCachedBooks();
        if (cached) {
            setCachedBooks([createdBook, ...cached]);
        }
        return createdBook;
    },

    async update(id: string, userId: string, data: Partial<Omit<Book, "id" | "userId" | "createdAt">>): Promise<Book | null> {
        ensureOnlineForWrite();

        const bookRef = doc(db, "books", id);
        const snapshot = await withTimeout(getDoc(bookRef));

        if (!snapshot.exists()) {
            return null;
        }

        const book = normalizeBook(snapshot.id, snapshot.data());
        if (book.userId !== userId) {
            return null;
        }

        await withTimeout(updateDoc(bookRef, {
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.author !== undefined ? { author: data.author } : {}),
            ...(data.genre !== undefined ? { genre: data.genre } : {}),
            ...(data.editorial !== undefined ? { editorial: data.editorial ?? null } : {}),
            ...(data.year !== undefined ? { year: data.year ?? null } : {}),
            ...(data.isbn !== undefined ? { isbn: data.isbn ?? null } : {}),
            ...(data.description !== undefined ? { description: data.description ?? null } : {}),
            ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl ?? null } : {}),
            ...(data.isFavorite !== undefined ? { isFavorite: data.isFavorite } : {}),
        }), FIRESTORE_WRITE_TIMEOUT_MS);

        const updatedBook = {
            ...book,
            ...data,
        };

        const cached = getCachedBooks();
        if (cached) {
            setCachedBooks(cached.map((item) => (item.id === id ? updatedBook : item)));
        }

        return updatedBook;
    },

    async delete(id: string, userId: string): Promise<boolean> {
        ensureOnlineForWrite();

        const bookRef = doc(db, "books", id);
        const snapshot = await withTimeout(getDoc(bookRef));

        if (!snapshot.exists()) {
            return false;
        }

        const book = normalizeBook(snapshot.id, snapshot.data());
        if (book.userId !== userId) {
            return false;
        }

        await withTimeout(deleteDoc(bookRef), FIRESTORE_WRITE_TIMEOUT_MS);
        const cached = getCachedBooks();
        if (cached) {
            setCachedBooks(cached.filter((item) => item.id !== id));
        } else {
            invalidateCachedBooks();
        }
        return true;
    },

    async toggleFavorite(id: string, userId: string): Promise<Book | null> {
        ensureOnlineForWrite();

        const bookRef = doc(db, "books", id);
        const snapshot = await withTimeout(getDoc(bookRef));

        if (!snapshot.exists()) {
            return null;
        }

        const book = normalizeBook(snapshot.id, snapshot.data());
        if (book.userId !== userId) {
            return null;
        }

        const isFavorite = !book.isFavorite;
        await withTimeout(updateDoc(bookRef, { isFavorite }), FIRESTORE_WRITE_TIMEOUT_MS);

        const updatedBook = {
            ...book,
            isFavorite,
        };

        const cached = getCachedBooks();
        if (cached) {
            setCachedBooks(cached.map((item) => (item.id === id ? updatedBook : item)));
        }

        return updatedBook;
    },

    async stats(userId: string): Promise<{ totalBooks: number; totalFavorites: number; totalGenres: number; booksThisMonth: number }> {
        const allBooks = await getAllBooks();
        const books = allBooks.filter((book) => book.userId === userId);
        const now = new Date();
        const thisMonth = books.filter((book) => {
            const date = new Date(book.createdAt);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });

        const genres = new Set(books.map((book) => book.genre));

        return {
            totalBooks: books.length,
            totalFavorites: books.filter((book) => book.isFavorite).length,
            totalGenres: genres.size,
            booksThisMonth: thisMonth.length,
        };
    },

    async recent(userId: string, limit = 6): Promise<Book[]> {
        const allBooks = await getAllBooks();
        const books = allBooks.filter((book) => book.userId === userId);
        return books
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    },

    async genreStats(userId: string): Promise<{ genre: string; count: number }[]> {
        const allBooks = await getAllBooks();
        const books = allBooks.filter((book) => book.userId === userId);
        const map: Record<string, number> = {};

        for (const book of books) {
            map[book.genre] = (map[book.genre] ?? 0) + 1;
        }

        return Object.entries(map)
            .map(([genre, count]) => ({ genre, count }))
            .sort((a, b) => b.count - a.count);
    },
};

export const Users = {
    async list(): Promise<DirectoryUser[]> {
        const snapshot = await withTimeout(getDocs(collection(db, "users")));
        const users = snapshot.docs.map((userDoc) =>
            normalizeDirectoryUser(userDoc.id, userDoc.data()),
        );

        return users.sort((a, b) => a.name.localeCompare(b.name, "es"));
    },

    async create(data: {
        name: string;
        email: string;
        password: string;
        role: UserRole;
    }): Promise<DirectoryUser> {
        ensureOnlineForWrite();

        const secondaryAppName = `users-crud-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        let createdAuthUser: FirebaseUser | null = null;

        const payload = {
            name: data.name,
            email: data.email,
            createdAt: new Date().toISOString(),
            role: data.role,
        };

        try {
            const credentials = await withTimeout(
                createUserWithEmailAndPassword(secondaryAuth, data.email, data.password),
                FIRESTORE_WRITE_TIMEOUT_MS,
            );
            createdAuthUser = credentials.user;

            await withTimeout(
                setDoc(doc(db, "users", createdAuthUser.uid), payload),
                FIRESTORE_WRITE_TIMEOUT_MS,
            );

            return normalizeDirectoryUser(createdAuthUser.uid, payload);
        } catch (error) {
            if (createdAuthUser) {
                try {
                    await deleteUser(createdAuthUser);
                } catch {
                    // Best effort rollback when profile creation fails.
                }
            }
            throw error;
        } finally {
            await deleteApp(secondaryApp);
        }
    },

    async update(
        id: string,
        data: Partial<Pick<DirectoryUser, "name" | "email" | "role">>,
    ): Promise<DirectoryUser | null> {
        ensureOnlineForWrite();

        const userRef = doc(db, "users", id);
        const snapshot = await withTimeout(getDoc(userRef));
        if (!snapshot.exists()) {
            return null;
        }

        const current = normalizeDirectoryUser(snapshot.id, snapshot.data());

        await withTimeout(
            updateDoc(userRef, {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.email !== undefined ? { email: data.email } : {}),
                ...(data.role !== undefined ? { role: data.role } : {}),
            }),
            FIRESTORE_WRITE_TIMEOUT_MS,
        );

        return {
            ...current,
            ...data,
        };
    },

    async delete(id: string): Promise<boolean> {
        ensureOnlineForWrite();

        const userRef = doc(db, "users", id);
        const snapshot = await withTimeout(getDoc(userRef));
        if (!snapshot.exists()) {
            return false;
        }

        await withTimeout(deleteDoc(userRef), FIRESTORE_WRITE_TIMEOUT_MS);
        return true;
    },
};
