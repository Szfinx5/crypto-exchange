/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrderPage from "../page";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "~/trpc/react";

// Mock the api.order.create and api.order.getStatus hooks
vi.mock("~/trpc/react", () => {
  let statusData: any = null;
  let onSuccess: any = null;
  let onError: any = null;

  return {
    api: {
      order: {
        create: {
          useMutation: vi.fn(() => ({
            mutate: (values: any) => {
              setTimeout(() => {
                if (onSuccess) onSuccess({ order: { id: "order123" } });
                if (onError) onError({ message: "Order creation failed" });
              }, 0);
            },
            isPending: false,
            isError: false,
            error: null,
            isSuccess: false,
            onSuccess: (cb: any) => {
              onSuccess = cb;
            },
            onError: (cb: any) => {
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
      __setStatusData: (data: any) => {
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
