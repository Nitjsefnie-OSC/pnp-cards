import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Verbo concreto: «Quitar todas», «Abrir proyecto»… */
  confirmLabel: string;
  /** Acción que borra algo: el botón se ve de color de peligro. */
  danger?: boolean;
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
}

export const useConfirmStore = create<ConfirmState>()(() => ({ request: null }));

/**
 * Pide confirmación con la ventana de la app (no la del navegador). Se resuelve con true si se
 * confirma y false si se cancela. Necesita un <ConfirmHost /> montado (está en el Layout).
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // Una petición anterior sin responder se da por cancelada.
  useConfirmStore.getState().request?.resolve(false);
  return new Promise((resolve) => useConfirmStore.setState({ request: { ...options, resolve } }));
}

/** Responde a la petición abierta. */
export function answerConfirm(ok: boolean) {
  const { request } = useConfirmStore.getState();
  useConfirmStore.setState({ request: null });
  request?.resolve(ok);
}
