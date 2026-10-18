// Partes de la File System Access API que solo tienen Chrome y Edge y que TypeScript no incluye.
interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface Window {
  showDirectoryPicker?(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: FileSystemHandle | 'documents' | 'pictures';
  }): Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?(options?: {
    id?: string;
    suggestedName?: string;
    startIn?: FileSystemHandle | 'documents';
    types?: FilePickerAcceptType[];
  }): Promise<FileSystemFileHandle>;
}
