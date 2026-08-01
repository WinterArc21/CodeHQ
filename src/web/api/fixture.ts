import type { Workflow } from "@schema/workflow";
import { EXAMPLE_WORKFLOW } from "../design/exampleWorkflow";
import type { CodeHQSnapshot, SourceStatus, WorkflowRecord } from "./types";

/**
 * DEVELOPMENT-ONLY fixture data. This module is imported by exactly one place —
 * `api/events.ts` — and only used when `isCodeHQFixtureEnabled()` is true, i.e.
 * `VITE_CODEHQ_FIXTURE === "1"`. It exists so the web app (and component tests) can be
 * built against a realistic, schema-shaped `CodeHQSnapshot` before `src/server` exists.
 * It must never be reachable from a normal `pnpm dev`/production build.
 */
export function isCodeHQFixtureEnabled(): boolean {
  return import.meta.env.VITE_CODEHQ_FIXTURE === "1";
}

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

/** A second workflow, distinct from the bundled example, used to exercise the "stale" state. */
const CHECKOUT_WORKFLOW: Workflow = {
  schemaVersion: "0.1",
  id: "checkout",
  name: "Checkout",
  purpose: "Captures payment for a cart and confirms the order to the customer.",
  status: "needs-review",
  entryPoint: { file: "src/server/routes/checkout.ts", symbol: "postCheckout", line: 18, endLine: 44 },
  steps: [
    {
      id: "receive-checkout",
      name: "Receive Checkout Request",
      purpose: "Accepts the cart id and payment method from the client.",
      category: "entry",
      confidence: "verified",
      sources: [{ file: "src/server/routes/checkout.ts", symbol: "postCheckout", line: 18, endLine: 24 }],
      outputs: [{ name: "CheckoutRequest" }],
    },
    {
      id: "validate-cart",
      name: "Validate Cart",
      purpose: "Confirms the cart still exists, has stock, and pricing has not changed.",
      category: "decision",
      confidence: "verified",
      sources: [{ file: "src/server/checkout/validateCart.ts", symbol: "validateCart", line: 5, endLine: 30 }],
      inputs: [{ name: "CheckoutRequest" }],
      outputs: [{ name: "ValidatedCart" }],
      edgeCases: [
        {
          name: "Price changed since the cart was created",
          handling: "Rejects with a price-mismatch error and a refreshed cart total.",
          confidence: "verified",
        },
      ],
    },
    {
      id: "capture-payment",
      name: "Capture Payment",
      purpose: "Charges the customer's payment method for the cart total.",
      category: "external",
      confidence: "human-confirmed",
      sources: [{ file: "src/server/payments/capture.ts", symbol: "capturePayment", line: 10, endLine: 52 }],
      inputs: [{ name: "ValidatedCart" }],
      outputs: [{ name: "PaymentReceipt" }],
      externalServices: [{ name: "Payment Processor", purpose: "Captures the charge.", operation: "POST /charges" }],
      edgeCases: [
        { name: "Card is declined", handling: "Returns a 402 with the processor's decline reason.", confidence: "inferred" },
      ],
    },
    {
      id: "record-order",
      name: "Record Order",
      purpose: "Persists the order and marks the cart as converted.",
      category: "data",
      confidence: "verified",
      sources: [{ file: "src/server/checkout/recordOrder.ts", symbol: "recordOrder", line: 4, endLine: 21 }],
      inputs: [{ name: "PaymentReceipt" }],
      outputs: [{ name: "Order" }],
    },
    {
      id: "send-confirmation",
      name: "Send Confirmation",
      purpose: "Emails the customer a receipt and order summary.",
      category: "output",
      confidence: "inferred",
      sources: [{ file: "src/server/email/confirmation.ts", symbol: "sendConfirmationEmail", line: 6, endLine: 19 }],
      inputs: [{ name: "Order" }],
    },
  ],
  connections: [
    { from: "receive-checkout", to: "validate-cart" },
    { from: "validate-cart", to: "capture-payment", type: "success" },
    { from: "validate-cart", to: "capture-payment", type: "success" },
    {
      from: "validate-cart",
      to: "send-confirmation",
      type: "failure",
      label: "rejected",
      condition: "Cart is invalid, out of stock, or priced incorrectly.",
    },
    { from: "capture-payment", to: "record-order", type: "success" },
    {
      from: "capture-payment",
      to: "send-confirmation",
      type: "conditional",
      label: "declined",
      condition: "The payment processor declines the charge.",
    },
    { from: "record-order", to: "send-confirmation", type: "async" },
  ],
  notes: ["A newer edit to this file currently fails validation; this is the last valid version."],
};

function buildGenerateVideoRecord(): WorkflowRecord {
  const sourceChecks: Record<string, SourceStatus> = {
    "app/api/generate/route.ts#POST": "verified",
    "lib/validation.ts#validateGenerateRequest": "verified",
    "lib/scraper.ts#scrapeWebsite": "file-only",
    "lib/productModel.ts#buildProductContext": "verified",
    "lib/storyPlanner.ts#generateStoryPlan": "missing",
  };
  return {
    id: EXAMPLE_WORKFLOW.id,
    file: `.codehq/workflows/${EXAMPLE_WORKFLOW.id}.json`,
    workflow: EXAMPLE_WORKFLOW,
    modifiedAt: minutesAgo(14),
    state: "valid",
    sourceChecks,
  };
}

function buildCheckoutRecord(): WorkflowRecord {
  const sourceChecks: Record<string, SourceStatus> = {
    "src/server/routes/checkout.ts#postCheckout": "verified",
    "src/server/checkout/validateCart.ts#validateCart": "verified",
    "src/server/payments/capture.ts#capturePayment": "file-only",
    "src/server/email/confirmation.ts#sendConfirmationEmail": "missing",
  };
  return {
    id: CHECKOUT_WORKFLOW.id,
    file: `.codehq/workflows/${CHECKOUT_WORKFLOW.id}.json`,
    workflow: CHECKOUT_WORKFLOW,
    modifiedAt: minutesAgo(180),
    state: "stale",
    staleSince: minutesAgo(6),
    sourceChecks,
  };
}

/** Builds a fresh fixture snapshot (fresh timestamps) every time it is called. */
export function buildCodeHQFixtureSnapshot(): CodeHQSnapshot {
  return {
    generatedAt: minutesAgo(0),
    status: "ready",
    repository: {
      name: "motiona",
      root: "/home/dev/projects/motiona",
      codeHQDir: "/home/dev/projects/motiona/.codehq",
    },
    project: {
      schemaVersion: "0.1",
      project: {
        id: "motiona",
        name: "Motiona",
        description: "Turns a submitted website into a short product video.",
      },
      settings: { defaultWorkflowId: EXAMPLE_WORKFLOW.id, sourceLinkMode: "editor" },
    },
    workflows: [buildGenerateVideoRecord(), buildCheckoutRecord()],
    diagnostics: {
      generatedAt: minutesAgo(6),
      valid: false,
      issues: [
        {
          severity: "error",
          file: ".codehq/workflows/checkout.json",
          path: "steps[2].colour",
          message: "Visual properties are owned by CodeHQ and must not appear in workflow files.",
          hint: "Remove this property. CodeHQ computes layout, color, and styling automatically.",
        },
        {
          severity: "warning",
          file: ".codehq/workflows/checkout.json",
          path: "connections[2]",
          message: "Duplicate connection from 'validate-cart' to 'capture-payment' (type: success).",
          hint: "Remove this duplicate, or differentiate it with a distinct 'condition' or 'type'.",
        },
      ],
    },
  };
}
