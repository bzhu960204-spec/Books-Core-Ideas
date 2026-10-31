import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Sidebar from './components/Sidebar';
import LibraryPage from './pages/LibraryPage';

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
  return <BookDetailPage key={id} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Suspense fallback={<div className="loading">Loading</div>}>
              <Routes>
                <Route path="/" element={<LibraryPage />} />
                <Route path="/book/:id" element={<BookDetailRoute />} />
                <Route path="/ideas" element={<IdeaBankPage />} />
                <Route path="/excerpts" element={<ExcerptBankPage />} />
                <Route path="/reviews" element={<ReviewBankPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/history" element={<ReadingHistoryPage />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
