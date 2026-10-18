import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ComingSoon } from './components/ComingSoon';
import { CardsPage } from './features/cards/CardsPage';
import { useSessionAutosave } from './project/useSessionAutosave';

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
          <Route path="merge" element={<ComingSoon titleKey="nav.merge" />} />
          <Route path="split" element={<ComingSoon titleKey="nav.split" />} />
          <Route path="pdf-to-images" element={<ComingSoon titleKey="nav.pdfToImages" />} />
          <Route path="extract-images" element={<ComingSoon titleKey="nav.extractImages" />} />
          <Route path="templates" element={<ComingSoon titleKey="nav.templates" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
