import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CardsPage } from './features/cards/CardsPage';
import { useExtractStore } from './features/extractImages/extractStore';
import { useAnalytics } from './analytics/useAnalytics';
import { useSessionAutosave } from './project/useSessionAutosave';

// Las herramientas secundarias (y pdf.js) se descargan al abrirlas.
const MergePage = lazy(() =>
  import('./features/merge/MergePage').then((m) => ({ default: m.MergePage })),
);
const SplitPage = lazy(() =>
  import('./features/split/SplitPage').then((m) => ({ default: m.SplitPage })),
);
const ExtractImagesPage = lazy(() =>
  import('./features/extractImages/ExtractImagesPage').then((m) => ({
    default: m.ExtractImagesPage,
  })),
);
const TemplatesPage = lazy(() =>
  import('./features/templates/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
);

const HelpPage = lazy(() =>
  import('./features/help/HelpPage').then((m) => ({ default: m.HelpPage })),
);

const PrivacyPage = lazy(() =>
  import('./features/privacy/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
);

/** «PDF a imágenes» ahora es el modo «Páginas completas» de Extraer imágenes. */
function PdfToImagesRedirect() {
  useEffect(() => useExtractStore.getState().setMode('pages'), []);
  return <Navigate to="/extract-images" replace />;
}

/** Tareas de fondo de la app: guardado de la sesión y estadísticas anónimas. */
function Background() {
  useSessionAutosave();
  useAnalytics();
  return null;
}

export function App() {
  return (
    <HashRouter>
      <Background />
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
          <Route path="pdf-to-images" element={<PdfToImagesRedirect />} />
          <Route
            path="extract-images"
            element={
              <Suspense fallback={null}>
                <ExtractImagesPage />
              </Suspense>
            }
          />
          <Route
            path="templates"
            element={
              <Suspense fallback={null}>
                <TemplatesPage />
              </Suspense>
            }
          />
          <Route
            path="help/:topic?"
            element={
              <Suspense fallback={null}>
                <HelpPage />
              </Suspense>
            }
          />
          <Route
            path="privacy"
            element={
              <Suspense fallback={null}>
                <PrivacyPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}
