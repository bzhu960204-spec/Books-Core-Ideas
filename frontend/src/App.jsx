import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Sidebar from './components/Sidebar';
import LibraryPage from './pages/LibraryPage';
import BookDetailPage from './pages/BookDetailPage';
import IdeaBankPage from './pages/IdeaBankPage';
import ExcerptBankPage from './pages/ExcerptBankPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<LibraryPage />} />
              <Route path="/book/:id" element={<BookDetailPage />} />
              <Route path="/ideas" element={<IdeaBankPage />} />
              <Route path="/excerpts" element={<ExcerptBankPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
