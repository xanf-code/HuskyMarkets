import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LoadMoreButton, useLoadMore } from "./LoadMore";

function Probe({
  items,
  resetKey,
  pageSize = 2,
}: {
  items: string[];
  resetKey?: string;
  pageSize?: number;
}) {
  const { visibleItems, hasMore, remaining, loadMore } = useLoadMore(items, {
    pageSize,
    resetKey,
  });
  return (
    <div>
      <ul>
        {visibleItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <LoadMoreButton
        hasMore={hasMore}
        remaining={remaining}
        onLoadMore={loadMore}
      />
    </div>
  );
}

describe("useLoadMore / LoadMoreButton", () => {
  it("shows the first page and reveals more on click", async () => {
    const user = userEvent.setup();
    render(<Probe items={["a", "b", "c", "d", "e"]} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /load more · 3 left/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: /load more · 1 left/i }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("hides the button when everything fits on one page", () => {
    render(<Probe items={["a", "b"]} pageSize={12} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("resets visible count when resetKey changes", () => {
    const { rerender } = render(
      <Probe items={["a", "b", "c", "d"]} resetKey="campus" />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    rerender(<Probe items={["x", "y", "z", "w"]} resetKey="sports" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("x")).toBeInTheDocument();
  });
});
