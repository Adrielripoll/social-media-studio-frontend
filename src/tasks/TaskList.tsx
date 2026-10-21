import { Expandable } from "../components/MotionPresence";
import { useId, useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from "lucide-react";
import type { Task } from "./api";
import { formatTaskDate, formatTaskAddedDate } from "./dates";

interface TaskListProps {
  tasks: Task[];
  busy: boolean;
  onComplete: (task: Task) => Promise<boolean>;
  onEdit: (task: Task, title: string) => Promise<boolean>;
  onDelete: (task: Task) => Promise<boolean>;
  empty: string;
  visibleLimit?: number;
  referenceDate?: string;
}
function TaskTitle({
  task,
  referenceDate,
}: {
  task: Task;
  referenceDate?: string;
}) {
  return (
    <span className="task-title">
      {task.title}
      {referenceDate && task.scheduledDate < referenceDate && (
        <>
          {" "}
          <span className="task-added-date">
            (Adicionado em: {formatTaskAddedDate(task.createdAt)})
          </span>
        </>
      )}
    </span>
  );
}
function TaskItem({
  task,
  busy,
  onComplete,
  onEdit,
  onDelete,
  referenceDate,
}: Omit<TaskListProps, "tasks" | "empty" | "visibleLimit"> & { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [title, setTitle] = useState(task.title);
  return (
    <li className={"task-item" + (task.completedAt ? " task-completed" : "")}>
      <Expandable open={editing}>
        <form
          className="task-edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onEdit(task, title)) setEditing(false);
          }}
        >
          <label>
            Título da tarefa
            <input
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              autoFocus
            />
          </label>
          <div className="task-form-actions">
            <button className="button primary" disabled={busy}>
              Salvar tarefa
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancelar edição
            </button>
          </div>
        </form>
      </Expandable>
      <Expandable open={!editing} animateInitial={false}>
        <div className="task-item-line">
          <label className="task-check">
            <input
              type="checkbox"
              checked={!!task.completedAt}
              disabled={busy}
              aria-label={
                (task.completedAt ? "Reabrir " : "Concluir ") + task.title
              }
              onChange={() => void onComplete(task)}
            />
            <span aria-hidden="true">
              {task.completedAt && <Check size={13} />}
            </span>
          </label>
          <TaskTitle task={task} referenceDate={referenceDate} />
          <div className="task-item-actions">
            <button
              className="task-icon-button"
              aria-label={"Editar " + task.title}
              disabled={busy}
              onClick={() => {
                setTitle(task.title);
                setEditing(true);
                setRemoving(false);
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              className="task-icon-button"
              aria-label={"Excluir " + task.title}
              disabled={busy}
              onClick={() => setRemoving(true)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {task.completedAt && (
          <span className="task-completed-note">Concluída</span>
        )}
        <Expandable open={removing && !editing}>
          <div
            className="task-delete-confirm"
            role="alertdialog"
            aria-label={"Excluir tarefa " + task.title}
          >
            <p>Excluir esta tarefa?</p>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={() => void onDelete(task)}
            >
              Confirmar exclusão
            </button>
            <button
              className="task-icon-button"
              aria-label="Cancelar exclusão"
              disabled={busy}
              onClick={() => setRemoving(false)}
            >
              <X size={16} />
            </button>
          </div>
        </Expandable>
      </Expandable>
    </li>
  );
}
export default function TaskList(props: TaskListProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (!props.tasks.length) return <p className="task-empty">{props.empty}</p>;
  const tasks = [...props.tasks].sort(
    (a, b) =>
      Number(!!a.completedAt) - Number(!!b.completedAt) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  const limit = props.visibleLimit ?? tasks.length;
  const canExpand = tasks.length > limit;
  const collapsed = canExpand && !expanded;
  const visibleTasks = collapsed ? tasks.slice(0, limit) : tasks;
  return (
    <div className="task-list-container">
      <ul id={listId} className="task-list" aria-label="Lista de tarefas">
        {visibleTasks.map((task) => (
          <TaskItem key={task.id} task={task} {...props} />
        ))}
      </ul>
      {collapsed && (
        <div className="task-list-preview" aria-hidden="true">
          {tasks.slice(limit, limit + 2).map((task) => (
            <div
              key={task.id}
              className={
                "task-preview-item" +
                (task.completedAt ? " task-completed" : "")
              }
            >
              <span
                className={
                  "task-preview-dot" + (task.completedAt ? " is-completed" : "")
                }
              >
                {task.completedAt && <Check size={13} />}
              </span>
              <TaskTitle task={task} referenceDate={props.referenceDate} />
            </div>
          ))}
        </div>
      )}
      {canExpand && (
        <button
          type="button"
          className="task-show-more"
          aria-expanded={expanded}
          aria-controls={listId}
          disabled={props.busy}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Mostrar menos" : "Mostrar mais"}
          {expanded ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

export function TaskDateHeading({ date }: { date: string }) {
  return <span className="task-date-label">{formatTaskDate(date)}</span>;
}
