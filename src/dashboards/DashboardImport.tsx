import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, LoaderCircle, RefreshCw } from "lucide-react";
import Dialog from "../components/Dialog";
import {
  confirmImport,
  DAILY_METRICS,
  errorMessage,
  getImportSchema,
  previewImport,
} from "./api";
import type { Dashboard, ImportPreview, ImportSchema } from "./api";
import { formatCount, periodLabel } from "./metrics";

export default function DashboardImport({
  dashboard,
  onImported,
  onClose,
}: {
  dashboard: Dashboard;
  onImported: (value: Dashboard) => void;
  onClose: () => void;
}) {
  const [schema, setSchema] = useState<ImportSchema | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sheets, setSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const request = useRef<AbortController | null>(null);
  const busy = reading || saving;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void getImportSchema(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSchema(value);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(reason));
        }
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => () => request.current?.abort(), []);

  async function readFiles(values: File[], selection: string[] = []) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFiles(values);
    setSheets(selection);
    setPreview(null);
    setError("");
    setReading(false);
    if (!values.length) {
      return;
    }
    if (
      values.length > (schema?.maxFiles ?? 6) ||
      values.some(
        (file) =>
          !/\.(csv|xlsx)$/i.test(file.name) ||
          file.size > (schema?.maxBytes ?? 5 * 1024 * 1024),
      )
    ) {
      setError("Selecione até 6 arquivos XLSX ou CSV, com até 5 MB cada.");
      return;
    }
    setReading(true);
    try {
      const value = await previewImport(
        dashboard.id,
        values,
        selection,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setPreview(value);
        setSheets(value.files.map((file) => file.selectedSheet));
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(errorMessage(reason));
      }
    } finally {
      if (!controller.signal.aborted) {
        setReading(false);
      }
    }
  }

  async function confirm() {
    if (busy || !preview?.valid) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      onImported(
        await confirmImport(dashboard.id, preview.revision, preview.points),
      );
    } catch (reason) {
      setError(errorMessage(reason));
      // A new preview is required after a revision conflict or an uncertain response.
      setPreview(null);
    } finally {
      setSaving(false);
    }
  }
  const dates = [...new Set(preview?.points.map((point) => point.date))].sort();
  const byPoint = new Map(
    preview?.points.map((point) => [
      point.date + "/" + point.metric,
      point.value,
    ]),
  );
  return (
    <Dialog
      title="Importar resultados da Meta"
      busy={busy}
      onClose={onClose}
      className="workspace-dialog dashboard-import-dialog"
    >
      <div className="workspace-form">
        <div className="dashboard-import-intro">
          <FileSpreadsheet size={28} aria-hidden="true" />
          <div>
            <h3>Importe as métricas exportadas pela Meta</h3>
            <p>
              Envie as planilhas exportadas pela Meta. Preserve o título e as
              colunas Data e Primary. Você não precisa preencher um modelo.
            </p>
          </div>
        </div>
        <p>
          Importando em <strong>{dashboard.name}</strong>
          {dashboard.accountName ? " · " + dashboard.accountName : ""}. Confira
          se todos os arquivos pertencem ao mesmo perfil.
        </p>
        <p className="dashboard-hint">
          Até {schema?.maxFiles ?? 6} arquivos, 5 MB cada e{" "}
          {schema?.maxRows ?? 1096} dias por arquivo. XLSX com várias abas
          permite escolher a aba de cada arquivo. Nenhum arquivo será
          armazenado.
        </p>
        <label>
          Selecionar planilhas da Meta
          <input
            type="file"
            accept=".csv,.xlsx"
            multiple
            disabled={busy || !schema}
            onChange={(event) => {
              void readFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>
        {error && (
          <div className="workspace-error" role="alert">
            <span>{error}</span>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                schema && files.length
                  ? void readFiles(files, sheets)
                  : setReload((value) => value + 1)
              }
            >
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          </div>
        )}
        {reading && (
          <p role="status">
            <LoaderCircle className="spin" size={18} /> Lendo e validando os
            arquivos…
          </p>
        )}
        {preview && (
          <>
            <ul
              className="dashboard-import-files"
              aria-label="Arquivos selecionados"
            >
              {preview.files.map((file, index) => (
                <li key={index}>
                  <strong>{file.filename}</strong>
                  <span>
                    {DAILY_METRICS.find((metric) => metric.key === file.metric)
                      ?.label ?? "Métrica não reconhecida"}{" "}
                    · {file.rowCount} linhas
                  </span>
                  {file.startDate && file.endDate && (
                    <small>
                      {periodLabel({
                        startDate: file.startDate,
                        endDate: file.endDate,
                      })}
                    </small>
                  )}
                  {file.filledZeros > 0 && (
                    <small>
                      {file.filledZeros === 1
                        ? "1 dia sem novos seguidores foi preenchido com zero."
                        : file.filledZeros +
                          " dias sem novos seguidores foram preenchidos com zero."}
                    </small>
                  )}
                  {file.sheetNames.length > 1 && (
                    <label>
                      Aba de {file.filename}
                      <select
                        aria-label={"Aba de " + file.filename}
                        disabled={busy}
                        value={file.selectedSheet}
                        onChange={(event) => {
                          const next = [...sheets];
                          next[index] = event.target.value;
                          void readFiles(files, next);
                        }}
                      >
                        {file.sheetNames.map((sheet) => (
                          <option key={sheet}>{sheet}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </li>
              ))}
            </ul>
            {preview.warnings.map((warning, index) => (
              <p className="dashboard-notice" key={index}>
                {warning}
              </p>
            ))}
            {!preview.valid && (
              <div className="workspace-error" role="alert">
                <div>
                  <strong>
                    Corrija {preview.issueCount} problema(s) antes de importar.
                  </strong>
                  <ul>
                    {preview.issues.map((issue, index) => (
                      <li key={index}>
                        {issue.filename}
                        {issue.row ? " · linha " + issue.row : ""}
                        {issue.column ? " · " + issue.column : ""}:{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {preview.valid && (
              <>
                <p className="dashboard-success" role="status">
                  Prévia pronta: {preview.changes.created} novos valores,{" "}
                  {preview.changes.updated} atualizações e{" "}
                  {preview.changes.unchanged} valores sem alteração.
                </p>
                <div
                  className="dashboard-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Prévia dos resultados diários"
                >
                  <table>
                    <caption>
                      Primeiros {Math.min(8, dates.length)} de {dates.length}{" "}
                      dias da importação
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        {DAILY_METRICS.map((metric) => (
                          <th scope="col" key={metric.key}>
                            {metric.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dates.slice(0, 8).map((date) => (
                        <tr key={date}>
                          <th scope="row">
                            {date.split("-").reverse().join("/")}
                          </th>
                          {DAILY_METRICS.map((metric) => (
                            <td key={metric.key}>
                              {formatCount(
                                byPoint.get(date + "/" + metric.key),
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="dashboard-hint">
              Somente os dias e métricas enviados serão atualizados. Os demais
              resultados e os relatórios antigos serão preservados. Dias
              ausentes de seguidores, entre a primeira e a última data desse
              arquivo, equivalem a zero; outras lacunas permanecem sem
              informação.
            </p>
          </>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy || !preview?.valid}
            onClick={() => void confirm()}
          >
            {saving ? "Importando…" : "Confirmar importação"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
