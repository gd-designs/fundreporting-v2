import { getEntities } from "@/lib/entities"
import { AllDocumentsManager } from "@/components/all-documents-manager"

export default async function DocumentsPage() {
  const entities = await getEntities()
  return <AllDocumentsManager entities={entities} />
}
