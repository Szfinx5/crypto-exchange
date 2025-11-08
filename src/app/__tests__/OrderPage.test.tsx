/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrderPage from "../page";

// Mock the entire TRPC module
vi.mock("~/trpc/react", () => ({
  api: {
    order: {
      create: {
        useMutation: vi.fn(),
      },
      getStatus: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Import the mocked api after the mock is set up
import { api } from "~/trpc/react";

describe("OrderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows completion message when order succeeds and status is completed", async () => {
    let onSuccessCallback:
      | ((data: any, variables: any, context: any) => void)
      | null = null;

    // Mock order creation mutation
    vi.mocked(api.order.create.useMutation).mockImplementation(
      (options?: any) =>
        ({
          mutate: vi.fn((variables) => {
            // Store the callback when mutation is created
            if (options?.onSuccess) {
              onSuccessCallback = options.onSuccess;
              // Trigger success immediately
              setTimeout(() => {
                onSuccessCallback?.(
                  { order: { id: "order123" } },
                  variables,
                  {}
                );
              }, 0);
            }
          }),
          isPending: false,
          isError: false,
          error: null,
          isSuccess: false,
        } as any)
    );

    // Mock status query to return COMPLETED
    vi.mocked(api.order.getStatus.useQuery).mockReturnValue({
      data: { status: "COMPLETED" },
      refetch: vi.fn(),
    } as any);

    render(<OrderPage />);

    fireEvent.click(screen.getByText(/\$ submit_order/i));

    // Wait for the completion message
    await waitFor(() => {
      expect(
        screen.getByText(/\(ID: order123\) Order completed!/i)
      ).toBeInTheDocument();
    });
  });

  it("shows retry message when order succeeds but status is failed", async () => {
    let onErrorCallback:
      | ((error: any, variables: any, context: any) => void)
      | null = null;

    // Mock order creation mutation with error
    vi.mocked(api.order.create.useMutation).mockImplementation(
      (options?: any) =>
        ({
          mutate: vi.fn((variables) => {
            // Store the callback when mutation is created
            if (options?.onError) {
              onErrorCallback = options.onError;
              // Trigger error immediately
              setTimeout(() => {
                onErrorCallback?.({ message: "Network error" }, variables, {});
              }, 0);
            }
          }),
          isPending: false,
          isError: false,
          error: null,
          isSuccess: false,
        } as any)
    );

    // Mock order creation mutation
    vi.mocked(api.order.create.useMutation).mockReturnValue({
      mutate: vi.fn((data) => {
        // Immediately trigger onSuccess
        const options = vi.mocked(api.order.create.useMutation).mock
          .calls[0]?.[0];
        if (options?.onSuccess) {
          setTimeout(() => options.onSuccess({ order: { id: "order123" } }), 0);
        }
      }),
      isPending: false,
      isError: false,
      error: null,
      isSuccess: false,
    } as any);

    // Mock status query to return FAILED
    vi.mocked(api.order.getStatus.useQuery).mockReturnValue({
      data: { status: "FAILED" },
      refetch: vi.fn(),
    } as any);

    render(<OrderPage />);

    fireEvent.click(screen.getByText(/\$ submit_order/i));

    // Wait for the retry message
    await waitFor(() => {
      expect(
        screen.getByText(/\(ID: order123\) Order failed\. Retrying\.\.\./i)
      ).toBeInTheDocument();
    });
  });
});
