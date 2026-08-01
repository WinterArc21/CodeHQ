import { DownloadSimple, ShareNetwork, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useBackdropDismiss } from "../../lib/useBackdropDismiss";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { Button, IconButton } from "../primitives";
import styles from "./ExportDialog.module.css";

export interface ExportDialogProps {
  workflowName: string;
  onClose: () => void;
  onDownload: (hideFilePaths: boolean) => Promise<void>;
  onShare: (hideFilePaths: boolean) => Promise<void>;
}

type ExportAction = "download" | "share";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Collects the privacy choice immediately before creating a downloadable/shareable artifact. */
export function ExportDialog({ workflowName, onClose, onDownload, onShare }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [hideFilePaths, setHideFilePaths] = useState<boolean | null>(null);
  const [pendingAction, setPendingAction] = useState<ExportAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    if (pendingAction === null) {
      onClose();
    }
  };
  useFocusTrap(dialogRef, true, close);
  const backdropDismiss = useBackdropDismiss(close);

  const submit = async (action: ExportAction): Promise<void> => {
    if (hideFilePaths === null) {
      setError("Choose whether to hide file paths before exporting.");
      return;
    }
    setPendingAction(action);
    setError(null);
    try {
      await (action === "download" ? onDownload(hideFilePaths) : onShare(hideFilePaths));
      onClose();
    } catch (actionError) {
      if (!isAbortError(actionError)) {
        setError(actionError instanceof Error ? actionError.message : "The export could not be created.");
      }
    } finally {
      setPendingAction(null);
    }
  };

  const busy = pendingAction !== null;
  return (
    <div
      className={styles.backdrop}
      {...backdropDismiss}
    >
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Prepare export</p>
            <h2 id="export-dialog-title" className={styles.title}>Export {workflowName}</h2>
          </div>
          <IconButton label="Close export dialog" icon={<X size={18} />} onClick={close} disabled={busy} />
        </div>

        <div className={styles.body}>
          <p className={styles.intro}>
            Choose whether the exported snapshot may include repository-relative file paths. This choice is applied before
            the HTML is generated.
          </p>
          <fieldset className={styles.choiceGroup}>
            <legend>Hide file paths?</legend>
            <label className={`${styles.choice} ${hideFilePaths ? styles.selected : ""}`}>
              <input
                type="radio"
                name="hide-file-paths"
                checked={hideFilePaths === true}
                onChange={() => setHideFilePaths(true)}
              />
              <span>
                <strong>Yes, hide them</strong>
                <small>Redacts every structured file reference and source status key.</small>
              </span>
            </label>
            <label className={`${styles.choice} ${hideFilePaths === false ? styles.selected : ""}`}>
              <input
                type="radio"
                name="hide-file-paths"
                checked={hideFilePaths === false}
                onChange={() => setHideFilePaths(false)}
              />
              <span>
                <strong>No, include them</strong>
                <small>Includes the repository-relative paths from the workflow description.</small>
              </span>
            </label>
          </fieldset>
          {error !== null ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              icon={<ShareNetwork size={16} />}
              onClick={() => void submit("share")}
              disabled={busy || hideFilePaths === null}
            >
              {pendingAction === "share" ? "Preparing..." : "Share"}
            </Button>
            <Button
              icon={<DownloadSimple size={16} />}
              onClick={() => void submit("download")}
              disabled={busy || hideFilePaths === null}
            >
              {pendingAction === "download" ? "Preparing..." : "Download HTML"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
