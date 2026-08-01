import { useEffect } from "react";
import { deleteWorkflow, recheck } from "./api/client";
import { useObservatorySnapshot } from "./api/events";
import { AppShell, TopBar, type ObservatoryStatus } from "./components/shell";
import { WorkflowNavigator } from "./components/navigator";
import { EmptyState, ErrorState, LoadingState, UninitializedState } from "./components/states";
import { DiagnosticsBanner, DiagnosticsPanel } from "./components/diagnostics";
import { WorkflowCanvas } from "./components/canvas";
import { StepDrawer } from "./components/drawer";
import { CommandPalette } from "./components/search";
import { useObservatoryStore } from "./store/useObservatoryStore";

function computeConnectionStatus(
  diagnosticsValid: boolean,
  hasStaleWorkflow: boolean,
  hookStatus: "loading" | "ready" | "error" | "disconnected",
): ObservatoryStatus {
  if (!diagnosticsValid) {
    return "invalid";
  }
  if (hookStatus === "disconnected") {
    return "disconnected";
  }
  return hasStaleWorkflow ? "stale" : "live";
}

export function App() {
  const { snapshot, status, error, refetch } = useObservatorySnapshot();

  const selectedWorkflowId = useObservatoryStore((state) => state.selectedWorkflowId);
  const selectWorkflow = useObservatoryStore((state) => state.selectWorkflow);
  const selectedStepId = useObservatoryStore((state) => state.selectedStepId);
  const selectStep = useObservatoryStore((state) => state.selectStep);
  const openSearch = useObservatoryStore((state) => state.openSearch);
  const diagnosticsOpen = useObservatoryStore((state) => state.diagnosticsOpen);
  const toggleDiagnostics = useObservatoryStore((state) => state.toggleDiagnostics);
  const closeDiagnostics = useObservatoryStore((state) => state.closeDiagnostics);

  useEffect(() => {
    if (snapshot === null) {
      return;
    }
    const knownIds = new Set(snapshot.workflows.map((record) => record.id));
    if (selectedWorkflowId !== null && knownIds.has(selectedWorkflowId)) {
      return;
    }
    const defaultId = snapshot.project?.settings?.defaultWorkflowId;
    const nextId = defaultId !== undefined && knownIds.has(defaultId) ? defaultId : snapshot.workflows[0]?.id;
    selectWorkflow(nextId ?? null);
  }, [snapshot, selectedWorkflowId, selectWorkflow]);

  if (snapshot === null) {
    if (status === "error") {
      return <ErrorState message={error ?? "Unable to reach the Code Observatory server."} onRetry={refetch} />;
    }
    return <LoadingState />;
  }

  if (snapshot.status === "uninitialized") {
    return <UninitializedState />;
  }

  const hasStaleWorkflow = snapshot.workflows.some((record) => record.state === "stale");
  const connectionStatus = computeConnectionStatus(snapshot.diagnostics.valid, hasStaleWorkflow, status);
  const errorCount = snapshot.diagnostics.issues.filter((issue) => issue.severity === "error").length;

  const selectedRecord = snapshot.workflows.find((record) => record.id === selectedWorkflowId) ?? null;
  const displayedWorkflow = selectedRecord?.workflow ?? null;
  const displayedSourceChecks = selectedRecord?.sourceChecks ?? {};

  const handleRecheck = async (): Promise<void> => {
    await recheck();
    refetch();
  };

  return (
    <>
      <AppShell
        topBar={
          <TopBar
            repositoryName={snapshot.repository.name}
            status={connectionStatus}
            {...(connectionStatus === "invalid" ? { errorCount } : {})}
            onOpenSearch={openSearch}
          />
        }
        aside={
          <WorkflowNavigator workflows={snapshot.workflows} selectedWorkflowId={selectedWorkflowId} onSelect={selectWorkflow} />
        }
      >
        <DiagnosticsBanner diagnostics={snapshot.diagnostics} onOpenDiagnostics={toggleDiagnostics} />
        {displayedWorkflow !== null ? (
          <WorkflowCanvas
            workflow={displayedWorkflow}
            sourceChecks={displayedSourceChecks}
            onDeleteWorkflow={async () => {
              await deleteWorkflow(displayedWorkflow.id);
              refetch();
            }}
          />
        ) : (
          <EmptyState onRecheck={handleRecheck} />
        )}
      </AppShell>
      {displayedWorkflow !== null && selectedStepId !== null ? (
        <StepDrawer
          workflow={displayedWorkflow}
          stepId={selectedStepId}
          sourceChecks={displayedSourceChecks}
          onClose={() => selectStep(null)}
          onSelectStep={selectStep}
        />
      ) : null}
      {diagnosticsOpen ? (
        <DiagnosticsPanel diagnostics={snapshot.diagnostics} onClose={closeDiagnostics} onRecheck={handleRecheck} />
      ) : null}
      <CommandPalette snapshot={snapshot} onRecheck={handleRecheck} />
    </>
  );
}
