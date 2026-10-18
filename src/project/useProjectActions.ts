import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '../components/download';
import { parseBsk } from '../lib/bsk';
import { safeFileName } from '../lib/filename';
import type { FolderFile } from '../lib/imageMatch';
import {
  parseProject,
  PROJECT_EXTENSION,
  PROJECT_MIME,
  ProjectError,
  serializeProject,
  type ProjectFile,
} from '../lib/project';
import { useCardsStore, type ImageFolder } from '../store/cardsStore';
import { pickFolder, reopenFolder, type PickedFolder } from './folder';
import { bskToProject, currentProject, openProjectWithFolder } from './projectIO';
import type { RecentProject } from './storage';
import { useProjectStorage } from './storageContext';

export type ProjectMessage = { text: string; tone: 'info' | 'error' };

/** Proyecto leído que espera a que el usuario indique dónde están sus imágenes. */
export interface PendingProject {
  project: ProjectFile;
  /** Carpeta recordada de otra vez (Recientes o la última sesión), si la hay. */
  knownFolder: ImageFolder | null;
  /** true al recuperar la última sesión al abrir la app. */
  restoring: boolean;
}

const isBsk = (file: File) => /\.bsk$/i.test(file.name);
export const isProjectFile = (file: File) =>
  file.name.toLowerCase().endsWith(PROJECT_EXTENSION) || isBsk(file);
const withoutExtension = (name: string) => name.replace(/\.[^.]+$/, '');
const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

interface LaunchParams {
  files: { getFile(): Promise<File> }[];
}
declare global {
  interface Window {
    launchQueue?: { setConsumer(consumer: (params: LaunchParams) => void): void };
  }
}

/** La sesión anterior se ofrece una sola vez por carga de la página. */
let sessionOffered = false;

/** Solo para tests: permite volver a ofrecer la sesión. */
export function resetSessionOffer() {
  sessionOffered = false;
}

/** Abrir, guardar y empezar proyectos, con los mensajes para el usuario. */
export function useProjectActions() {
  const { t } = useTranslation();
  const storage = useProjectStorage();
  const [message, setMessage] = useState<ProjectMessage | null>(null);
  const [pending, setPending] = useState<PendingProject | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmReplace = useCallback(
    (text: string) => useCardsStore.getState().cards.length === 0 || window.confirm(text),
    [],
  );

  const openFile = useCallback(
    async (file: File) => {
      if (!confirmReplace(t('project.replaceConfirm'))) return;
      let project: ProjectFile;
      try {
        const text = await file.text();
        project = isBsk(file)
          ? bskToProject(parseBsk(text), withoutExtension(file.name))
          : parseProject(text);
      } catch (err) {
        const newer = err instanceof ProjectError && err.code === 'newer-version';
        setMessage({
          text: t(newer ? 'project.newer' : 'project.invalid', { name: file.name }),
          tone: 'error',
        });
        return;
      }
      if (!project.name) project = { ...project, name: withoutExtension(file.name) };
      const recent = (await storage.listRecent().catch(() => [])).find(
        (r) => r.project.name === project.name,
      );
      setMessage(null);
      setPending({ project, knownFolder: recent?.folder ?? null, restoring: false });
    },
    [confirmReplace, storage, t],
  );

  const openRecent = useCallback(
    (entry: RecentProject) => {
      if (!confirmReplace(t('project.replaceConfirm'))) return false;
      setMessage(null);
      setPending({ project: entry.project, knownFolder: entry.folder, restoring: false });
      return true;
    },
    [confirmReplace, t],
  );

  /** Termina de abrir el proyecto pendiente con la carpeta (o las imágenes) indicadas. */
  const finish = useCallback(
    async (picked: PickedFolder) => {
      if (!pending) return;
      setBusy(true);
      try {
        const missing = await openProjectWithFolder(pending.project, picked);
        setPending(null);
        // Se recuerda el proyecto tal como venía, también con las imágenes que falten.
        await storage
          .addRecent({ project: pending.project, folder: picked.folder })
          .catch(() => {});
        setMessage(
          missing.length > 0
            ? { text: t('folder.missing', { names: missing.join(', ') }), tone: 'error' }
            : { text: t('project.opened', { name: pending.project.name }), tone: 'info' },
        );
      } finally {
        setBusy(false);
      }
    },
    [pending, storage, t],
  );

  const chooseFolder = useCallback(async () => {
    try {
      const picked = await pickFolder(pending?.knownFolder?.handle);
      if (picked) await finish(picked);
    } catch {
      setMessage({ text: t('folder.unreadable'), tone: 'error' });
    }
  }, [finish, pending, t]);

  const useKnownFolder = useCallback(async () => {
    if (!pending?.knownFolder) return;
    try {
      const picked = await reopenFolder(pending.knownFolder);
      if (picked) await finish(picked);
      else setMessage({ text: t('folder.denied'), tone: 'error' });
    } catch {
      // La carpeta se ha movido o borrado: hay que elegirla otra vez.
      setMessage({ text: t('folder.gone', { name: pending.knownFolder.name }), tone: 'error' });
    }
  }, [finish, pending, t]);

  const chooseFiles = useCallback(
    (files: FolderFile[]) => finish({ folder: { name: '', handle: null }, files }),
    [finish],
  );

  const saveFile = useCallback(async () => {
    const project = currentProject();
    const fileName = `${safeFileName(project.name) || t('project.defaultName')}${PROJECT_EXTENSION}`;
    const blob = new Blob([serializeProject(project)], { type: PROJECT_MIME });
    const folder = useCardsStore.getState().folder;
    try {
      if (window.showSaveFilePicker) {
        // Por defecto, junto a las imágenes.
        const handle = await window.showSaveFilePicker({
          id: 'pnp-cards-project',
          suggestedName: fileName,
          ...(folder?.handle ? { startIn: folder.handle } : {}),
          types: [{ description: 'PnP Cards', accept: { [PROJECT_MIME]: [PROJECT_EXTENSION] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        downloadBlob(blob, fileName);
      }
    } catch (err) {
      if (isAbort(err)) return;
      setMessage({ text: t('project.saveFailed'), tone: 'error' });
      return;
    }
    await storage.addRecent({ project, folder }).catch(() => {});
    setMessage({ text: t('project.savedFile', { name: fileName }), tone: 'info' });
  }, [storage, t]);

  const newProject = useCallback(() => {
    if (!confirmReplace(t('project.newConfirm'))) return;
    useCardsStore.getState().reset();
    setMessage(null);
  }, [confirmReplace, t]);

  // Ofrece seguir con la última sesión: necesita un clic para volver a leer la carpeta.
  useEffect(() => {
    if (sessionOffered) return;
    sessionOffered = true;
    void storage
      .loadSession()
      .then((session) => {
        const hasImages = session?.project.cards.some((c) => c.name);
        if (session && hasImages && useCardsStore.getState().cards.length === 0) {
          setPending({ project: session.project, knownFolder: session.folder, restoring: true });
        }
      })
      .catch(() => {});
  }, [storage]);

  // Archivos .pnpcards abiertos con doble clic cuando la app está instalada (PWA).
  useEffect(() => {
    window.launchQueue?.setConsumer(async ({ files }) => {
      const [handle] = files;
      if (handle) await openFile(await handle.getFile());
    });
  }, [openFile]);

  return {
    message,
    busy,
    pending,
    cancelPending: () => setPending(null),
    openFile,
    openRecent,
    chooseFolder,
    useKnownFolder,
    chooseFiles,
    saveFile,
    newProject,
  };
}
