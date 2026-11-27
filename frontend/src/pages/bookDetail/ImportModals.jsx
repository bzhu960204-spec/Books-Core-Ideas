import { importApi } from '../../api';
import { useRefresh } from '../../queries';
import { structureImport } from '../../utils/jsonImport';
import JsonImportModal from '../../components/JsonImportModal';
import { CHAPTERS_JSON_HINT, PARTS_JSON_HINT } from './jsonImportHints';

// JSON import (FE-08): one server-side transaction per import; bodies from utils/jsonImport.

/** "Import JSON" of the whole book: its structure (chapters or parts). */
export function BookImportModal({ bookId, isParts, onClose }) {
  const refresh = useRefresh();

  const handleStructureImport = async (parsed, mode) => {
    await importApi.structure(bookId, structureImport(parsed, mode, isParts));
    await refresh();
  };

  return (
    <JsonImportModal
      title="Import JSON"
      tabs={[
        isParts
          ? { key: 'parts', label: 'Parts', placeholder: PARTS_JSON_HINT, onImport: handleStructureImport }
          : { key: 'chapters', label: 'Chapters', placeholder: CHAPTERS_JSON_HINT, onImport: handleStructureImport, addOnly: true },
      ]}
      onClose={onClose}
    />
  );
}
