import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle, RefreshCw } from "lucide-react";
import Dialog from "../components/Dialog";
import {
  confirmImport,
  errorMessage,
  getImportSchema,
  METRICS,
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
  const [schema, setSchema] = useState<ImportSchema | null>(null),
    [reload, setReload] = useState(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null),
    [filename, setFilename] = useState("");
  const [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    file = useRef<File | null>(null);
  const request = useRef<AbortController | null>(null);
  const busy = reading || saving;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void getImportSchema(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSchema(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(
    () => () => {
      request.current?.abort();
      file.current = null;
    },
    [],
  );
  async function readFile(value: File, sheet?: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPreview(null);
    setError("");
    setFilename(value.name);
    file.current = value;
    if (
      !/\.(xlsx|csv)$/i.test(value.name) ||
      value.size > (schema?.maxBytes ?? 5 * 1024 * 1024)
    ) {
      setError("Selecione um arquivo XLSX ou CSV de até 5 MB.");
      return;
    }
    setReading(true);
    try {
      const result = await previewImport(dashboard.id, value, sheet, controller.signal);
      if (!controller.signal.aborted) setPreview(result);
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setReading(false);
    }
  }
  function download() {
    if (!schema) return;
    const url = URL.createObjectURL(
      new Blob([schema.exampleCsv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-dashboard-instagram.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function confirm() {
    if (busy || !preview?.valid) return;
    setSaving(true);
    setError("");
    try {
      onImported(await confirmImport(dashboard.id, dashboard.revision, preview.periods));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Importar resultados"
      onClose={onClose}
      busy={busy}
      className="dashboard-import-dialog"
    >
      <p className="dialog-intro">
        Uma linha por período. Confira os dados antes de confirmar; o arquivo não ficará
        armazenado.
      </p>
      {schema ? (
        <>
          <div className="dashboard-import-actions">
            <button className="button secondary" onClick={download}>
              <Download size={16} />
              Baixar planilha modelo
            </button>
            <span className="workspace-muted">
              O modelo contém exemplos. Substitua pelos seus resultados.
            </span>
          </div>
          <details className="dashboard-schema" open={!preview}>
            <summary>Modelo das colunas</summary>
            <p>
              Use datas AAAA-MM-DD ou DD/MM/AAAA e números inteiros, como 1234 ou 1.234.
              Colunas em qualquer ordem; pelo menos uma métrica por período. Deixe vazio o
              que não foi medido.
            </p>
            <div
              className="dashboard-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Modelo de colunas"
            >
              <table>
                <caption className="visually-hidden">
                  Colunas aceitas na importação
                </caption>
                <thead>
                  <tr>
                    <th>Coluna</th>
                    <th>Significado</th>
                    <th>Obrigatória</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.columns.map((column) => (
                    <tr key={column.column}>
                      <td>
                        <code>{column.column}</code>
                      </td>
                      <td>{column.label}</td>
                      <td>{column.required ? "Sim" : "Não"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="dashboard-import-actions">
            <input
              ref={input}
              className="visually-hidden"
              type="file"
              accept=".xlsx,.csv"
              aria-label="Selecionar planilha de resultados"
              disabled={busy}
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (next) void readFile(next);
                event.target.value = "";
              }}
            />
            <button
              className="button primary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <FileSpreadsheet size={18} />
              {filename ? "Trocar planilha" : "Selecionar planilha"}
            </button>
            <span className="workspace-muted">
              {filename || "XLSX ou CSV · até 5 MB e 500 períodos"}
            </span>
          </div>
        </>
      ) : (
        !error && (
          <p className="workspace-muted" role="status">
            Carregando modelo…
          </p>
        )
      )}
      {reading && (
        <p className="dashboard-status" role="status">
          <LoaderCircle className="spin" size={18} />
          Lendo e validando a planilha…
        </p>
      )}
      {error && (
        <div className="workspace-error" role="alert">
          <span>{error}</span>
          {!schema && (
            <button className="button secondary" onClick={() => setReload((v) => v + 1)}>
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {preview && (
        <>
          {preview.sheetNames.length > 1 && (
            <label className="field">
              <span>Aba da planilha</span>
              <select
                aria-label="Aba da planilha"
                value={preview.selectedSheet}
                disabled={busy}
                onChange={(event) => {
                  if (file.current) void readFile(file.current, event.target.value);
                }}
              >
                {preview.sheetNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
          {!!preview.warnings.length && (
            <div className="dashboard-notice" role="status">
              {preview.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {!preview.valid && (
            <div className="workspace-error dashboard-import-errors" role="alert">
              <strong>Corrija a planilha antes de importar.</strong>
              <ul>
                {preview.issues.map((issue, index) => (
                  <li key={index}>
                    {issue.row ? "Linha " + issue.row : "Arquivo"}
                    {issue.column ? " · " + issue.column : ""}: {issue.message}
                  </li>
                ))}
              </ul>
              {preview.issueCount > preview.issues.length && (
                <p>
                  Mostrando os primeiros {preview.issues.length} de {preview.issueCount}{" "}
                  problemas.
                </p>
              )}
            </div>
          )}
          <div className="dashboard-preview-heading">
            <h3>Prévia dos resultados</h3>
            <span>
              {preview.rowCount} {preview.rowCount === 1 ? "período" : "períodos"}
            </span>
          </div>
          <div
            className="dashboard-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Prévia dos resultados"
          >
            <table>
              <caption>
                Primeiros {Math.min(8, preview.periods.length)} períodos. Nenhum dado foi
                salvo.
              </caption>
              <thead>
                <tr>
                  <th>Período</th>
                  {METRICS.map((metric) => (
                    <th key={metric.key}>{metric.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.periods.slice(0, 8).map((period, index) => (
                  <tr key={index}>
                    <td>{periodLabel(period)}</td>
                    {METRICS.map((metric) => (
                      <td key={metric.key}>{formatCount(period[metric.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!dashboard.periods.length && (
            <p className="dashboard-notice">
              Ao confirmar, os {dashboard.periods.length} períodos atuais serão
              substituídos pelos dados desta planilha. Nome, cliente e análise serão
              mantidos.
            </p>
          )}
        </>
      )}
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          className="button primary"
          onClick={() => void confirm()}
          disabled={busy || !preview?.valid}
        >
          {saving
            ? "Importando…"
            : dashboard.periods.length
              ? "Confirmar e substituir períodos"
              : "Confirmar importação"}
        </button>
      </div>
    </Dialog>
  );
}
