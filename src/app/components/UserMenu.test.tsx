import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import UserMenu from "./UserMenu";

const mockSignOut = jest.fn();

jest.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("UserMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders user initials from name when no image", () => {
    render(<UserMenu user={{ name: "John Doe", email: "john@test.com" }} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders user initial from email when no name or image", () => {
    render(<UserMenu user={{ email: "test@test.com" }} />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders ? initial when no name or email", () => {
    render(<UserMenu user={{}} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders avatar image when user.image is set", () => {
    render(
      <UserMenu user={{ name: "John", image: "https://example.com/avatar.jpg" }} />
    );
    // alt="" makes the image role="presentation", so query by tag instead
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("https://example.com/avatar.jpg");
  });

  it("menu is closed initially", () => {
    render(<UserMenu user={{ name: "John" }} />);
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("clicking button opens menu", () => {
    render(<UserMenu user={{ name: "John", email: "john@test.com" }} />);
    const button = screen.getByLabelText("User menu");
    fireEvent.click(button);

    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.getByText("My Analyses")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("clicking backdrop closes menu", () => {
    render(<UserMenu user={{ name: "John" }} />);
    const button = screen.getByLabelText("User menu");
    fireEvent.click(button);

    expect(screen.getByText("Sign out")).toBeInTheDocument();

    // Click the backdrop (fixed inset-0 div)
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("clicking Sign out calls signOut", () => {
    render(<UserMenu user={{ name: "John" }} />);
    const button = screen.getByLabelText("User menu");
    fireEvent.click(button);

    const signOutBtn = screen.getByText("Sign out");
    fireEvent.click(signOutBtn);

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("shows name from user.name, falls back to User", () => {
    render(<UserMenu user={{ name: "Jane Smith" }} />);
    const button = screen.getByLabelText("User menu");
    fireEvent.click(button);

    // Name appears in both the button span and the dropdown menu header
    const nameElements = screen.getAllByText("Jane Smith");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });

  it("menu contains links to /history and /account", () => {
    render(<UserMenu user={{ name: "John", email: "john@test.com" }} />);
    const button = screen.getByLabelText("User menu");
    fireEvent.click(button);

    const historyLink = screen.getByText("My Analyses");
    expect(historyLink.closest("a")).toHaveAttribute("href", "/history");

    const accountLink = screen.getByText("Account");
    expect(accountLink.closest("a")).toHaveAttribute("href", "/account");
  });
});
