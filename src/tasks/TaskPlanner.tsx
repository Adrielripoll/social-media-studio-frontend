import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { ApiError } from "../auth/api";
import {
  completeTask,
  createTask,
  deleteTask,
  editTask,
  listTasks,
  listTodayTasks,
} from "./api";
import type { Task } from "./api";
import {
  formatMonth,
  formatTaskDate,
  monthRange,
  shiftMonth,
  todayDate,
  taskDateFromTimestamp,
} from "./dates";
import { Expandable } from "../components/MotionPresence";
import TaskList, { TaskDateHeading } from "./TaskList";
import "./tasks.css";

function TaskCreateForm({
  busy,
  onCreate,
  onCancel,
}: {
  busy: boolean;
  onCreate: (title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="task-add-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onCreate(title);
      }}
    >
      <label>
        Nova tarefa
        <input
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
          autoFocus
          placeholder="O que você precisa fazer?"
        />
      </label>
      <div className="task-form-actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Salvando…" : "Criar tarefa"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function TaskPlanner() {
  const [today, setToday] = useState(todayDate);
  const [month, setMonth] = useState(() => todayDate().slice(0, 7));
  const [monthTasks, setMonthTasks] = useState<Task[]>([]);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingToday, setAddingToday] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const requests = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const calendar = useRef<HTMLElement | null>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const range = monthRange(month);

  useEffect(() => {
    const controller = new AbortController();
    requests.current?.abort();
    requests.current = controller;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    async function load() {
      try {
        const [response, current] = await Promise.all([
          listTasks(range.from, range.to, controller.signal),
          listTodayTasks(controller.signal),
        ]);
        if (
          !Array.isArray(response.tasks) ||
          !Array.isArray(current.tasks) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(current.today)
        )
          throw new ApiError(502);
        if (controller.signal.aborted) return;
        setMonthTasks(response.tasks);
        setTodayTasks(current.tasks);
        setToday(current.today);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Não foi possível carregar as tarefas. Tente novamente.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [month, today, reload]);

  useEffect(() => {
    function refreshDate() {
      const date = todayDate();
      setToday((old) => {
        if (old !== date)
          setMonth((current) =>
            current === old.slice(0, 7) ? date.slice(0, 7) : current,
          );
        return date;
      });
    }
    const timer = window.setInterval(refreshDate, 30_000);
    function focus() {
      refreshDate();
      if (!writing.current) setReload((value) => value + 1);
    }
    window.addEventListener("focus", focus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    if (!selected) return;
    closeButton.current?.focus();
    function outside(event: PointerEvent) {
      if (!calendar.current?.contains(event.target as Node)) {
        setSelected(null);
        setAdding(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
        setAdding(false);
        selectedButton.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [selected]);

  function applyTask(task: Task | null, id: string) {
    function replace(tasks: Task[], included: boolean) {
      const rest = tasks.filter((item) => item.id !== id);
      return task && included ? [...rest, task] : rest;
    }
    setMonthTasks((tasks) =>
      replace(
        tasks,
        !!task &&
          task.scheduledDate >= range.from &&
          task.scheduledDate <= range.to,
      ),
    );
    setTodayTasks((tasks) =>
      replace(
        tasks,
        !!task &&
          (task.scheduledDate === today ||
            (task.scheduledDate < today &&
              (!task.completedAt ||
                taskDateFromTimestamp(task.completedAt) === today))),
      ),
    );
  }
  async function mutate(
    action: () => Promise<Task | null>,
    id = "",
  ): Promise<boolean> {
    if (busy) return false;
    writing.current = true;
    setBusy(true);
    setError("");
    try {
      const task = await action();
      applyTask(task, task?.id ?? id);
      return true;
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Não foi possível salvar a tarefa. Tente novamente.",
      );
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  const actions = {
    busy: busy || loading || loadFailed,
    onComplete: (task: Task) =>
      mutate(() => completeTask(task.id, !task.completedAt), task.id),
    onEdit: (task: Task, nextTitle: string) =>
      mutate(() => editTask(task.id, nextTitle), task.id),
    onDelete: (task: Task) =>
      mutate(async () => {
        await deleteTask(task.id);
        return null;
      }, task.id),
  };
  function navigate(delta: number) {
    setMonth((current) => shiftMonth(current, delta));
    setSelected(null);
    setAdding(false);
  }
  const offset = new Date(month + "-01T12:00:00Z").getUTCDay();
  const cells = Array.from(
    { length: Math.ceil((offset + range.count) / 7) * 7 },
    (_, index) => {
      const number = index - offset + 1;
      return number > 0 && number <= range.count
        ? month + "-" + String(number).padStart(2, "0")
        : null;
    },
  );
  const completed = todayTasks.filter((task) => task.completedAt).length;
  return (
    <section
      className="task-planner"
      aria-label="Calendário e tarefas pessoais"
    >
      <section className="task-today-card" aria-labelledby="today-title">
        <div className="task-card-heading">
          <div>
            <span className="task-eyebrow">TAREFAS DIÁRIAS</span>
            <h2 id="today-title">Suas tarefas de hoje</h2>
            <TaskDateHeading date={today} />
          </div>
          <span className="task-progress">
            {loading
              ? "Atualizando…"
              : loadFailed
                ? "Indisponível"
                : completed + "/" + todayTasks.length + " concluídas"}
          </span>
        </div>
        {loading && (
          <p className="task-loading" role="status">
            <LoaderCircle size={15} className="spin" />
            Carregando tarefas…
          </p>
        )}
        <TaskList
          {...actions}
          key={today}
          tasks={todayTasks}
          visibleLimit={6}
          referenceDate={today}
          empty={
            loading
              ? "Preparando seu dia…"
              : loadFailed
                ? "Suas tarefas estão indisponíveis. Recarregue para consultar seu dia."
                : "Seu dia está livre. Adicione uma tarefa para começar."
          }
        />
        <Expandable open={addingToday}>
          <TaskCreateForm
            busy={busy || loading || loadFailed}
            onCreate={async (nextTitle) => {
              if (await mutate(() => createTask(nextTitle, today)))
                setAddingToday(false);
            }}
            onCancel={() => setAddingToday(false)}
          />
        </Expandable>
        {!addingToday && (
          <button
            className="task-add-button"
            disabled={busy || loading || loadFailed}
            onClick={() => {
              setSelected(null);
              setAdding(false);
              setAddingToday(true);
            }}
          >
            <Plus size={17} />
            Adicionar tarefa
          </button>
        )}
      </section>
      {error && (
        <div className="task-error" role="alert">
          <span>{error}</span>
          <button
            className="button secondary"
            disabled={busy || loading}
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw size={14} />
            Recarregar tarefas
          </button>
        </div>
      )}
      <section
        className="task-calendar-card"
        aria-label="Calendário"
        ref={calendar}
      >
        <div className="task-calendar-heading">
          <div>
            <span className="task-eyebrow">ORGANIZE OS PRÓXIMOS DIAS</span>
            <h2>
              <CalendarDays size={19} />
              {formatMonth(month)}
            </h2>
          </div>
          <div className="task-calendar-navigation">
            <button
              className="task-icon-button"
              disabled={busy || month === "1000-01"}
              aria-label="Mês anterior"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="button secondary task-today-button"
              disabled={busy}
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelected(null);
                setAdding(false);
              }}
            >
              Hoje
            </button>
            <button
              className="task-icon-button"
              disabled={busy || month === "9999-12"}
              aria-label="Próximo mês"
              onClick={() => navigate(1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="task-calendar-week" aria-hidden="true">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
            <span key={index}>{day}</span>
          ))}
        </div>
        <div className="task-calendar-grid">
          {cells.map((date, index) => {
            if (!date)
              return (
                <span className="task-calendar-blank" key={"blank-" + index} />
              );
            const tasks = monthTasks.filter(
              (task) => task.scheduledDate === date,
            );
            return (
              <button
                key={date}
                disabled={busy || loading}
                className={
                  "task-calendar-day" +
                  (date === today ? " is-today" : "") +
                  (selected === date ? " is-selected" : "") +
                  (date < today ? " is-past" : "")
                }
                aria-label={formatTaskDate(date, false)}
                aria-current={date === today ? "date" : undefined}
                aria-haspopup="dialog"
                aria-expanded={selected === date}
                onClick={(event) => {
                  selectedButton.current = event.currentTarget;
                  setSelected(date);
                  setAdding(false);
                }}
              >
                <span>{Number(date.slice(-2))}</span>
                {tasks.length > 0 && (
                  <span
                    className={
                      "task-day-dot" +
                      (tasks.every((task) => task.completedAt)
                        ? " all-done"
                        : "")
                    }
                    aria-label={tasks.length + " tarefas"}
                  >
                    {tasks.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="task-calendar-note">
          Clique em um dia para ver ou adicionar tarefas.
        </p>
        {selected && (
          <div
            className="task-calendar-popover"
            role="dialog"
            aria-modal="false"
            aria-label={"Tarefas de " + formatTaskDate(selected, false)}
          >
            <header>
              <div>
                <span className="task-eyebrow">SEU PLANEJAMENTO</span>
                <h3>{formatTaskDate(selected, false)}</h3>
              </div>
              <button
                ref={closeButton}
                className="task-icon-button"
                aria-label="Fechar tarefas do dia"
                onClick={() => {
                  setSelected(null);
                  setAdding(false);
                  selectedButton.current?.focus();
                }}
              >
                <X size={18} />
              </button>
            </header>
            <div className="task-popover-list">
              <TaskList
                {...actions}
                tasks={monthTasks.filter(
                  (task) => task.scheduledDate === selected,
                )}
                empty={
                  loadFailed
                    ? "Não foi possível consultar as tarefas deste dia."
                    : "Nenhuma tarefa para este dia."
                }
              />
            </div>
            <Expandable open={adding}>
              <TaskCreateForm
                key={selected}
                busy={busy}
                onCreate={async (nextTitle) => {
                  if (await mutate(() => createTask(nextTitle, selected)))
                    setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            </Expandable>
            {!adding && (
              <button
                className="task-add-button"
                disabled={busy || loading || loadFailed || selected < today}
                onClick={() => setAdding(true)}
              >
                <Plus size={17} />
                Adicionar tarefa
              </button>
            )}
            {selected < today && (
              <p className="task-past-note">
                Novas tarefas podem ser criadas para hoje ou dias futuros.
              </p>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
