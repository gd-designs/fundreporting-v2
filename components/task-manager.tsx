"use client";

import * as React from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Columns2,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DatePickerInput } from "@/components/date-input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  type Task,
  type TaskStatus,
  type TaskPriority,
  type AssignedUser,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  fetchTasks,
  createTask,
  patchTask,
  deleteTask,
} from "@/lib/tasks";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { TaskSheet, type Task as SheetTask } from "@/components/task-sheet";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { UnifiedEntity } from "@/lib/types";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OBJECT_TYPES: Record<string, Array<{ value: string; label: string }>> = {
  asset_manager: [
    { value: "asset", label: "Asset" },
    { value: "fund", label: "Fund" },
    { value: "investor_lead", label: "Investor Lead" },
  ],
  portfolio: [{ value: "asset", label: "Asset" }],
  company: [{ value: "asset", label: "Asset" }],
  family_office: [{ value: "asset", label: "Asset" }],
  fund: [{ value: "asset", label: "Asset" }],
}

const OBJECT_TYPE_LABELS: Record<string, string> = {
  asset: "Asset",
  fund: "Fund",
  investor_lead: "Investor Lead",
}

const ENTITY_HREFS: Record<string, string> = {
  portfolio: "/portfolio",
  company: "/company",
  fund: "/fund",
  family_office: "/family-office",
  asset_manager: "/asset-manager",
};

function formatDue(ts: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

function isOverdue(ts: number | null, status: TaskStatus) {
  if (!ts || status === "done" || status === "cancelled") return false;
  return ts < Date.now();
}

function toDateInputValue(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toISOString().split("T")[0];
}

function fromDateInputValue(s: string): number | null {
  if (!s) return null;
  return new Date(s).getTime();
}

// ─── Status icon ─────────────────────────────────────────────────────────────

function StatusIcon({
  status,
  size = "size-4",
}: {
  status: TaskStatus;
  size?: string;
}) {
  if (status === "done") return <Check className={`${size} text-green-600`} />;
  if (status === "in_progress")
    return <Loader2 className={`${size} text-blue-500`} />;
  if (status === "cancelled")
    return <X className={`${size} text-muted-foreground`} />;
  return <Circle className={`${size} text-muted-foreground`} />;
}

// ─── Assigned avatars ─────────────────────────────────────────────────────────

function initials(user: AssignedUser) {
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

function AssignedAvatars({ users }: { users: AssignedUser[] }) {
  if (users.length === 0) return null;
  const visible = users.slice(0, 3);
  const extra = users.length - visible.length;
  return (
    <AvatarGroup>
      {visible.map((u) => (
        <HoverCard key={u.id} openDelay={200}>
          <HoverCardTrigger asChild>
            <Avatar size="sm" className="cursor-default">
              {u.avatar?.url && <AvatarImage src={u.avatar.url} alt={u.name ?? ""} />}
              <AvatarFallback className="text-[10px]">{initials(u)}</AvatarFallback>
            </Avatar>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto min-w-40 p-3">
            {u.name && <p className="text-sm font-medium">{u.name}</p>}
            {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
            {!u.name && !u.email && <p className="text-xs text-muted-foreground">User {u.id}</p>}
          </HoverCardContent>
        </HoverCard>
      ))}
      {extra > 0 && (
        <AvatarGroupCount className="text-[10px]">+{extra}</AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}

// ─── Task form dialog ─────────────────────────────────────────────────────────

type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority | "";
  dueDate: string;
};

function TaskFormDialog({
  open,
  task,
  entityId,
  entities,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: Task | null;
  entityId?: string;
  entities?: UnifiedEntity[];
  onClose: () => void;
  onSaved: (t: Task) => void;
}) {
  const isEdit = !!task;

  const [form, setForm] = React.useState<TaskFormValues>({
    title: "",
    description: "",
    status: "todo",
    priority: "",
    dueDate: "",
  });
  const [selectedEntityId, setSelectedEntityId] = React.useState<string>("");
  const [selectedObjectType, setSelectedObjectType] = React.useState<string>("");
  const [selectedObjectId, setSelectedObjectId] = React.useState<string>("");
  const [objects, setObjects] = React.useState<Array<{ id: string; name: string }>>([]);
  const [objectsLoading, setObjectsLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Derived: entity record for the currently selected entity UUID
  const selectedEntity = React.useMemo(
    () => entities?.find((e) => e.entity === selectedEntityId) ?? null,
    [entities, selectedEntityId],
  );
  const objectTypeOptions = selectedEntity ? (OBJECT_TYPES[selectedEntity.type] ?? []) : [];

  React.useEffect(() => {
    if (open) {
      setForm({
        title: task?.title ?? "",
        description: task?.description ?? "",
        status: task?.status ?? "todo",
        priority: task?.priority ?? "",
        dueDate: toDateInputValue(task?.dueDate ?? null),
      });
      setSelectedEntityId(task?.entityId ?? entityId ?? "");
      setSelectedObjectType(task?.objectType ?? "");
      setSelectedObjectId(task?.objectId ?? "");
      setObjects([]);
      setError(null);
    }
  }, [open, task, entityId]);

  // Fetch objects when entity + object type are set
  React.useEffect(() => {
    if (!selectedEntityId || !selectedObjectType || !selectedEntity) {
      setObjects([]);
      return;
    }
    setObjectsLoading(true);
    let url: string;
    if (selectedObjectType === "asset") {
      url = `/api/assets?entity=${encodeURIComponent(selectedEntityId)}`;
    } else if (selectedObjectType === "fund") {
      url = `/api/funds?managed_by=${encodeURIComponent(selectedEntity.id)}`;
    } else if (selectedObjectType === "investor_lead") {
      url = `/api/investor-leads?asset_manager=${encodeURIComponent(selectedEntity.id)}`;
    } else {
      setObjects([]);
      setObjectsLoading(false);
      return;
    }
    fetch(url)
      .then((r) => r.json())
      .then((data: unknown) => {
        const arr = Array.isArray(data) ? data : [];
        setObjects(
          (arr as Record<string, unknown>[])
            .map((o) => ({ id: String(o.id ?? ""), name: String(o.name ?? o.title ?? o.id ?? "") }))
            .filter((o) => o.id),
        );
      })
      .catch(() => setObjects([]))
      .finally(() => setObjectsLoading(false));
  }, [selectedEntityId, selectedObjectType]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof TaskFormValues>(key: K, val: TaskFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: (form.priority || null) as TaskPriority | null,
        dueDate: fromDateInputValue(form.dueDate),
        assignedTo: task?.assignedTo ?? [],
        entity: selectedEntityId || undefined,
        entityId: selectedEntityId || undefined,
        objectType: selectedObjectType || null,
        objectId: selectedObjectId || null,
      };
      let saved: Task;
      if (isEdit && task) {
        saved = await patchTask(task.id, {
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          due_date: payload.dueDate,
          object_type: payload.objectType,
          object_id: payload.objectId,
        });
      } else {
        saved = await createTask({
          ...payload,
          entity: selectedEntityId || undefined,
        });
      }
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Task title"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional notes…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as TaskStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority || "none"}
                onValueChange={(v) =>
                  set("priority", v === "none" ? "" : (v as TaskPriority))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No priority</SelectItem>
                  {(["low", "medium", "high", "urgent"] as TaskPriority[]).map(
                    (p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DatePickerInput
            label="Due date"
            value={form.dueDate ? new Date(form.dueDate + "T00:00:00") : undefined}
            onChange={(date) => {
              if (!date) { set("dueDate", ""); return; }
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              set("dueDate", `${y}-${m}-${d}`);
            }}
            placeholder="Pick a due date"
          />
          {!entityId && entities && entities.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Entity</Label>
              <Select
                value={selectedEntityId || "none"}
                onValueChange={(v) => {
                  setSelectedEntityId(v === "none" ? "" : v);
                  setSelectedObjectType("");
                  setSelectedObjectId("");
                  setObjects([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No entity</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.entity}>
                      {e.name ?? e.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {objectTypeOptions.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Object type</Label>
              <Select
                value={selectedObjectType || "none"}
                onValueChange={(v) => {
                  setSelectedObjectType(v === "none" ? "" : v);
                  setSelectedObjectId("");
                  setObjects([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No object type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No object type</SelectItem>
                  {objectTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedObjectType && (
            <div className="grid gap-1.5">
              <Label>Object</Label>
              {objectsLoading ? (
                <div className="h-9 rounded-md border flex items-center px-3 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading…
                </div>
              ) : (
                <Select
                  value={selectedObjectId || "none"}
                  onValueChange={(v) => setSelectedObjectId(v === "none" ? "" : v)}
                  disabled={objects.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={objects.length === 0 ? "No items available" : "Select…"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {objects.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  entityName,
  entityHref,
  objectTag,
  onStatusToggle,
  onEdit,
  onDelete,
  onOpen,
}: {
  task: Task;
  entityName: string | null;
  entityHref: string | null;
  objectTag: string | null;
  onStatusToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onOpen: (task: Task) => void;
}) {
  const overdue = isOverdue(task.dueDate, task.status);
  const isDone = task.status === "done";

  return (
    <div
      className={`group flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-muted/30 transition-colors ${isDone ? "opacity-60" : ""}`}
    >
      {/* Status toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onStatusToggle(task); }}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title={isDone ? "Reopen" : "Mark done"}
      >
        <StatusIcon status={task.status} />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpen(task)}>
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}
          >
            {task.title}
          </p>
          {task.priority && (
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[task.priority]}`}
            >
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {entityName && entityHref && (
            <a
              href={entityHref}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {entityName}
            </a>
          )}
          {objectTag && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {objectTag}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.description}
          </p>
        )}
        {task.dueDate && (
          <p
            className={`text-xs mt-0.5 flex items-center gap-1 ${overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
          >
            {overdue && <AlertCircle className="size-3 shrink-0" />}
            <Calendar className="size-3 shrink-0" />
            {formatDue(task.dueDate)}
          </p>
        )}
      </div>

      {/* Assigned users */}
      {task.assignedToUsers.length > 0 && (
        <div className="shrink-0 self-center">
          <AssignedAvatars users={task.assignedToUsers} />
        </div>
      )}

      {/* Actions */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {STATUS_ORDER.filter((s) => s !== task.status).map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() =>
                  onStatusToggle({
                    ...task,
                    status: s === task.status ? "todo" : s,
                  })
                }
              >
                Move to {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Status group ─────────────────────────────────────────────────────────────

function StatusGroup({
  status,
  tasks,
  entityMap,
  objectNameMap,
  onStatusToggle,
  onEdit,
  onDelete,
  onOpen,
  defaultOpen,
}: {
  status: TaskStatus;
  tasks: Task[];
  entityMap: Map<string, UnifiedEntity>;
  objectNameMap: Map<string, string>;
  onStatusToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onOpen: (task: Task) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {STATUS_LABELS[status]}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </button>
      {open && (
        <div className="space-y-0.5 pl-1">
          {tasks.map((task) => {
            const entity = task.entityId
              ? entityMap.get(task.entityId)
              : undefined;
            const entityHref = entity
              ? `${ENTITY_HREFS[entity.type] ?? ""}/${entity.id}`
              : null;
            const objectTag =
              task.objectType && task.objectId
                ? (objectNameMap.get(task.objectId) ?? OBJECT_TYPE_LABELS[task.objectType] ?? task.objectType)
                : null;
            return (
              <TaskRow
                key={task.id}
                task={task}
                entityName={entity?.name ?? null}
                entityHref={entityHref}
                objectTag={objectTag}
                onStatusToggle={onStatusToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                onOpen={onOpen}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  entityName,
  entityHref,
  objectTag,
  overlay = false,
  onEdit,
  onDelete,
  onMoveStatus,
  onOpen,
}: {
  task: Task;
  entityName: string | null;
  entityHref: string | null;
  objectTag: string | null;
  overlay?: boolean;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onMoveStatus: (task: Task, status: TaskStatus) => void;
  onOpen: (task: Task) => void;
}) {
  const overdue = isOverdue(task.dueDate, task.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group rounded-lg border bg-card p-3 shadow-sm space-y-2 select-none ${
        isDragging && !overlay ? "opacity-40" : ""
      } ${overlay ? "shadow-lg rotate-1 cursor-grabbing" : "hover:shadow-md transition-shadow cursor-grab"}`}
      onClick={() => onOpen(task)}
    >
      <div className="flex items-start justify-between gap-1">
        <p
          className={`text-sm font-medium leading-snug ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
        >
          {task.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5 -mr-1"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(task)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {STATUS_ORDER.filter((s) => s !== task.status).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMoveStatus(task, s)}>
                Move to {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {task.priority && (
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[task.priority]}`}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
        {entityName && entityHref && (
          <a
            href={entityHref}
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {entityName}
          </a>
        )}
        {objectTag && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
            {objectTag}
          </span>
        )}
      </div>

      {(task.dueDate || task.assignedToUsers.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          {task.dueDate ? (
            <p
              className={`text-xs flex items-center gap-1 ${overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
            >
              {overdue && <AlertCircle className="size-3 shrink-0" />}
              <Calendar className="size-3 shrink-0" />
              {formatDue(task.dueDate)}
            </p>
          ) : <span />}
          <AssignedAvatars users={task.assignedToUsers} />
        </div>
      )}
    </div>
  );
}

// ─── Kanban column (droppable) ────────────────────────────────────────────────

function KanbanColumn({
  status,
  tasks,
  entityMap,
  objectNameMap,
  onEdit,
  onDelete,
  onMoveStatus,
  onOpen,
}: {
  status: TaskStatus;
  tasks: Task[];
  entityMap: Map<string, UnifiedEntity>;
  objectNameMap: Map<string, string>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onMoveStatus: (task: Task, status: TaskStatus) => void;
  onOpen: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col gap-2 min-w-65 w-65 shrink-0">
      <div className="flex items-center gap-2 px-1">
        <StatusIcon status={status} size="size-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {STATUS_LABELS[status]}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 rounded-lg p-2 min-h-30 transition-colors ${
          isOver ? "bg-muted/60 ring-2 ring-border" : "bg-muted/30"
        }`}
      >
        {tasks.map((task) => {
          const entity = task.entityId ? entityMap.get(task.entityId) : undefined;
          const entityHref = entity ? `${ENTITY_HREFS[entity.type] ?? ""}/${entity.id}` : null;
          const objectTag =
            task.objectType && task.objectId
              ? (objectNameMap.get(task.objectId) ?? OBJECT_TYPE_LABELS[task.objectType] ?? task.objectType)
              : null;
          return (
            <KanbanCard
              key={task.id}
              task={task}
              entityName={entity?.name ?? null}
              entityHref={entityHref}
              objectTag={objectTag}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveStatus={onMoveStatus}
              onOpen={onOpen}
            />
          );
        })}
        {tasks.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-16 rounded-md border border-dashed">
            <p className="text-xs text-muted-foreground">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  groupedByStatus,
  entityMap,
  objectNameMap,
  onEdit,
  onDelete,
  onMoveStatus,
  onOpen,
}: {
  groupedByStatus: Record<TaskStatus, Task[]>;
  entityMap: Map<string, UnifiedEntity>;
  objectNameMap: Map<string, string>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onMoveStatus: (task: Task, status: TaskStatus) => void;
  onOpen: (task: Task) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {STATUS_ORDER.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={groupedByStatus[status]}
          entityMap={entityMap}
          objectNameMap={objectNameMap}
          onEdit={onEdit}
          onDelete={onDelete}
          onMoveStatus={onMoveStatus}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TaskManager({
  entityId,
  entities,
  title = "Tasks",
  description = "Open and completed tasks.",
  openTaskId,
}: {
  entityId?: string;
  entities?: UnifiedEntity[];
  title?: string;
  description?: string;
  openTaskId?: string;
}) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "all">(
    "all",
  );
  const [priorityFilter, setPriorityFilter] = React.useState<
    TaskPriority | "all"
  >("all");
  const [view, setView] = React.useState<"list" | "board">("list");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editTask, setEditTask] = React.useState<Task | null>(null);
  const [objectNameMap, setObjectNameMap] = React.useState<Map<string, string>>(new Map());
  const [draggingTask, setDraggingTask] = React.useState<Task | null>(null);
  const [sheetTask, setSheetTask] = React.useState<SheetTask | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // entity UUID → entity map
  const entityMap = React.useMemo(
    () => new Map((entities ?? []).map((e) => [e.entity, e])),
    [entities],
  );

  async function load() {
    setLoading(true);
    try {
      const data = await fetchTasks(entityId);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open sheet for a specific task when navigated from a notification
  React.useEffect(() => {
    if (!openTaskId || loading) return;
    const task = tasks.find((t) => t.id === openTaskId);
    if (task) openSheet(task);
  }, [openTaskId, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve object names for tasks that have objectType + objectId
  React.useEffect(() => {
    const types = new Set(tasks.map((t) => t.objectType).filter(Boolean) as string[]);
    if (types.size === 0) { setObjectNameMap(new Map()); return; }
    const newMap = new Map<string, string>();
    const fetches: Promise<void>[] = [];
    function addFetch(url: string) {
      fetches.push(
        fetch(url).then((r) => r.json()).then((data: unknown) => {
          if (Array.isArray(data)) {
            (data as Record<string, unknown>[]).forEach((o) => {
              if (o.id && (o.name ?? o.title)) newMap.set(String(o.id), String(o.name ?? o.title));
            });
          }
        }).catch(() => {}),
      );
    }
    if (types.has("asset")) addFetch(entityId ? `/api/assets?entity=${encodeURIComponent(entityId)}` : "/api/assets");
    if (types.has("fund")) addFetch("/api/funds");
    if (types.has("investor_lead")) addFetch("/api/investor-leads");
    void Promise.all(fetches).then(() => setObjectNameMap(new Map(newMap)));
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all")
      list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all")
      list = list.filter((t) => t.priority === priorityFilter);
    return list;
  }, [tasks, search, statusFilter, priorityFilter]);

  const groupedByStatus = React.useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const t of filtered) groups[t.status].push(t);
    return groups;
  }, [filtered]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleStatusToggle(task: Task) {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    // Optimistic
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
    );
    try {
      await patchTask(task.id, { status: newStatus });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
    }
  }

  async function handleMoveStatus(task: Task, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );
    try {
      await patchTask(task.id, { status });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setDraggingTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null);
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const newStatus = over.id as TaskStatus;
    if (!task || task.status === newStatus) return;
    void handleMoveStatus(task, newStatus);
  }

  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTask(id);
    } catch {
      void load();
    }
  }

  function handleSaved(saved: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  function openCreate() {
    setEditTask(null);
    setDialogOpen(true);
  }
  function openEdit(task: Task) {
    setEditTask(task);
    setDialogOpen(true);
  }
  function openSheet(task: Task) {
    setSheetTask({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.dueDate,
      entity: task.entityId,
      created_at: task.createdAt,
    });
    setSheetOpen(true);
  }
  function handleSheetUpdated(updated: SheetTask) {
    setSheetTask(updated);
    setTasks((prev) => prev.map((t) => t.id === updated.id ? {
      ...t,
      title: updated.title ?? t.title,
      description: updated.description ?? null,
      status: (updated.status as Task["status"]) ?? t.status,
      priority: (updated.priority as Task["priority"]) ?? null,
      dueDate: updated.due_date ?? null,
    } : t));
  }
  function handleSheetDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSheetOpen(false);
  }

  const openCount = tasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  ).length;

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {loading
                ? "Loading…"
                : `${openCount} open · ${tasks.length} total`}
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" />
            Add task
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={priorityFilter}
              onValueChange={(v) =>
                setPriorityFilter(v as TaskPriority | "all")
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {(["urgent", "high", "medium", "low"] as TaskPriority[]).map(
                  (p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border p-0.5 gap-0.5">
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                onClick={() => setView("list")}
                title="List view"
              >
                <LayoutList className="size-3.5" />
              </Button>
              <Button
                variant={view === "board" ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                onClick={() => setView("board")}
                title="Board view"
              >
                <Columns2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty className="border py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Check />
              </EmptyMedia>
              <EmptyTitle>
                {search || statusFilter !== "all" || priorityFilter !== "all"
                  ? "No matching tasks"
                  : "No tasks yet"}
              </EmptyTitle>
              <EmptyDescription>
                {search || statusFilter !== "all" || priorityFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Create a task to track work for this entity."}
              </EmptyDescription>
            </EmptyHeader>
            {!search && statusFilter === "all" && priorityFilter === "all" && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="size-3.5" />
                Add task
              </Button>
            )}
          </Empty>
        ) : view === "board" ? (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <KanbanBoard
              groupedByStatus={groupedByStatus}
              entityMap={entityMap}
              objectNameMap={objectNameMap}
              onMoveStatus={handleMoveStatus}
              onEdit={openEdit}
              onDelete={handleDelete}
              onOpen={openSheet}
            />
            <DragOverlay>
              {draggingTask ? (() => {
                const entity = draggingTask.entityId ? entityMap.get(draggingTask.entityId) : undefined;
                const entityHref = entity ? `${ENTITY_HREFS[entity.type] ?? ""}/${entity.id}` : null;
                const objectTag =
                  draggingTask.objectType && draggingTask.objectId
                    ? (objectNameMap.get(draggingTask.objectId) ?? OBJECT_TYPE_LABELS[draggingTask.objectType] ?? draggingTask.objectType)
                    : null;
                return (
                  <KanbanCard
                    task={draggingTask}
                    entityName={entity?.name ?? null}
                    entityHref={entityHref}
                    objectTag={objectTag}
                    overlay
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onMoveStatus={handleMoveStatus}
                    onOpen={openSheet}
                  />
                );
              })() : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="space-y-1">
            {STATUS_ORDER.map((status) => (
              <StatusGroup
                key={status}
                status={status}
                tasks={groupedByStatus[status]}
                entityMap={entityMap}
                objectNameMap={objectNameMap}
                onStatusToggle={handleStatusToggle}
                onEdit={openEdit}
                onDelete={handleDelete}
                onOpen={openSheet}
                defaultOpen={status === "todo" || status === "in_progress"}
              />
            ))}
          </div>
        )}
      </div>

      <TaskFormDialog
        open={dialogOpen}
        task={editTask}
        entityId={entityId}
        entities={entities}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      <TaskSheet
        task={sheetTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={handleSheetUpdated}
        onDeleted={handleSheetDeleted}
      />
    </div>
  );
}
