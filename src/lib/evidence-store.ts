import type { ExtractedDoc } from "./analysis-schema";

export interface SavedEvidence { id: string; caseId: string; file: Blob; filename: string; document: ExtractedDoc; }
const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open("rentresolve-evidence-v1", 1);
  request.onupgradeneeded = () => {
    const store = request.result.createObjectStore("evidence", { keyPath: "id" });
    store.createIndex("caseId", "caseId");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error("This browser could not open evidence storage."));
});
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("evidence", mode);
    const request = action(tx.objectStore("evidence"));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error("Evidence could not be saved. Check this browser's storage settings.")); };
  });
}
export const loadEvidence = (caseId: string): Promise<SavedEvidence[]> => transact("readonly", s => s.index("caseId").getAll(caseId));
export const saveEvidence = (entry: SavedEvidence) => transact("readwrite", s => s.put(entry));
export const removeEvidence = (id: string) => transact("readwrite", s => s.delete(id));
export async function deleteCaseEvidence(caseId: string) {
  const items = await loadEvidence(caseId);
  await Promise.all(items.map(item => removeEvidence(item.id)));
}