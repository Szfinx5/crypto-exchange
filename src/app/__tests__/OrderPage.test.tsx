/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "~/trpc/react";
import OrderPage from "../page";

// Mock the api.order.create and api.order.getStatus hooks
vi.mock("~/trpc/react", () => {
  let statusData: { status: string } | null = null;
  let onSuccess: ((data: { order: { id: string } }) => void) | null = null;
  let onError: ((error: { message: string }) => void) | null = null;

  return {
    api: {
      order: {
        create: {
          useMutation: vi.fn(() => ({
            mutate: (values: Record<string, unknown>) => {
              setTimeout(() => {
                if (onSuccess) onSuccess({ order: { id: "order123" } });
                if (onError) onError({ message: "Order creation failed" });
              }, 0);
            },
            isPending: false,
            isError: false,
            error: null,
            isSuccess: false,
            onSuccess: (cb: (data: { order: { id: string } }) => void) => {
              onSuccess = cb;
            },
            onError: (cb: (error: { message: string }) => void) => {
              onError = cb;
            },
          })),
        },
        getStatus: {
          useQuery: vi.fn(() => ({
            data: statusData,
            refetch: vi.fn(),
          })),
        },
      },
      // Expose setters for test control
      __setStatusData: (data: { status: string } | null) => {
        statusData = data;
      },
      __reset: () => {
        statusData = null;
        onSuccess = null;
        onError = null;
      },
    },
  };
});

describe("OrderPage", () => {
  beforeEach(() => {
    (api as any).__reset();
    vi.clearAllMocks();
  });

  it("shows success message for successful order", async () => {
    (api as any).__setStatusData({ status: "COMPLETED" });

    render(<OrderPage />);
    fireEvent.click(screen.getByText(/\$ submit_order/i));

    await waitFor(() => {
      expect(screen.getByText(/Order completed!/i)).toBeInTheDocument();
    });
  });

  it("shows retry message for failed order", async () => {
    (api as any).__setStatusData({ status: "FAILED" });

    render(<OrderPage />);
    fireEvent.click(screen.getByText(/\$ submit_order/i));

    await waitFor(() => {
      expect(
        screen.getByText(/Order failed. Retrying.../i)
      ).toBeInTheDocument();
    });
  });
});
