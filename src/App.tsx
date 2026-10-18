import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ComingSoon } from './components/ComingSoon';
import { CardsPage } from './features/cards/CardsPage';
import { useSessionAutosave } from './project/useSessionAutosave';

// Las herramientas secundarias (y pdf.js) se descargan al abrirlas.
const MergePage = lazy(() =>
  import('./features/merge/MergePage').then((m) => ({ default: m.MergePage })),
);
const SplitPage = lazy(() =>
  import('./features/split/SplitPage').then((m) => ({ default: m.SplitPage })),
);
const PdfToImagesPage = lazy(() =>
  import('./features/pdfToImages/PdfToImagesPage').then((m) => ({ default: m.PdfToImagesPage })),
);

function SessionAutosave() {
  useSessionAutosave();
  return null;
}

export function App() {
  return (
    <HashRouter>
      <SessionAutosave />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CardsPage />} />
          <Route
            path="merge"
            element={
              <Suspense fallback={null}>
                <MergePage />
              </Suspense>
            }
          />
          <Route
            path="split"
            element={
              <Suspense fallback={null}>
                <SplitPage />
              </Suspense>
            }
          />
          <Route
            path="pdf-to-images"
            element={
              <Suspense fallback={null}>
                <PdfToImagesPage />
              </Suspense>
            }
          />
          <Route path="extract-images" element={<ComingSoon titleKey="nav.extractImages" />} />
          <Route path="templates" element={<ComingSoon titleKey="nav.templates" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
