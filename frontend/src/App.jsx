import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/feedback/ErrorBoundary';
import Toaster from './components/feedback/Toaster';
import LibraryPage from './pages/LibraryPage';
import NotFoundPage from './pages/NotFoundPage';

// The library is the first screen; every other page is loaded when first opened (FE-04).
const BookDetailPage = lazy(() => import('./pages/BookDetailPage'));
const IdeaBankPage = lazy(() => import('./pages/IdeaBankPage'));
const ExcerptBankPage = lazy(() => import('./pages/ExcerptBankPage'));
const ReviewBankPage = lazy(() => import('./pages/ReviewBankPage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const ReadingHistoryPage = lazy(() => import('./pages/ReadingHistoryPage'));

// A fresh page per book: expanded chapters, open dialogs etc. don't carry over.
function BookDetailRoute() {
  const { id } = useParams();
  if (!/^\d+$/.test(id)) return <NotFoundPage title="Book not found" message={`“${id}” is not a book.`} />;
  return <BookDetailPage key={id} />;
}

// A page that throws shows an error screen in the main area; the sidebar keeps
// working, and going to another page clears the error (FE-05).
function PageErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <ErrorBoundary root>
      <ThemeProvider>
        <BrowserRouter>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              <PageErrorBoundary>
                <Suspense fallback={<div className="loading">Loading</div>}>
                  <Routes>
                    <Route path="/" element={<LibraryPage />} />
                    <Route path="/book/:id" element={<BookDetailRoute />} />
                    <Route path="/ideas" element={<IdeaBankPage />} />
                    <Route path="/excerpts" element={<ExcerptBankPage />} />
                    <Route path="/reviews" element={<ReviewBankPage />} />
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/history" element={<ReadingHistoryPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </PageErrorBoundary>
            </main>
          </div>
          <Toaster />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
