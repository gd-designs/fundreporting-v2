"use client"

import * as React from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DocumentSheet } from "@/components/document-sheet"
import type { Document } from "@/lib/types"

export function DashboardDocumentsCard({ initialDocuments }: { initialDocuments: Document[] }) {
  const [documents, setDocuments] = React.useState<Document[]>(initialDocuments)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  function openDocument(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  function handleDeleted(id: string) {
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Recent documents</CardTitle>
          <Button asChild variant="link" className="h-auto px-0 text-xs">
            <Link href="/documents">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {documents.slice(0, 5).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDocument(d.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name ?? "Unnamed document"}</p>
                    {d.created_at && (
                      <p className="text-muted-foreground text-xs">
                        {new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href="/documents">
              <FileText />
              View all documents
            </Link>
          </Button>
        </CardContent>
      </Card>

      <DocumentSheet
        documentId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onDeleted={handleDeleted}
      />
    </>
  )
}
