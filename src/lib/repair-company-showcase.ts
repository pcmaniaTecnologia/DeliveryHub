import { collection, doc, getDocs, runTransaction, type Firestore } from 'firebase/firestore';

/** Restore legacy selections without overwriting a concurrent deselection. */
export async function repairCompanyShowcaseIndex(
  firestore: Firestore,
  companies: ReadonlyArray<{ id: string; showcaseEnabled?: boolean }>,
  isCancelled = () => false,
) {
  const index = await getDocs(collection(firestore, 'companyShowcase'));
  const indexed = new Set(index.docs.map(entry => entry.id));
  const missing = companies.filter(company => company.showcaseEnabled === true && !indexed.has(company.id));
  for (const company of missing) {
    if (isCancelled()) return;
    await runTransaction(firestore, async transaction => {
      const current = await transaction.get(doc(firestore, 'companies', company.id));
      if (current.data()?.showcaseEnabled === true) {
        transaction.set(doc(firestore, 'companyShowcase', company.id), { companyId: company.id });
      }
    });
  }
}
