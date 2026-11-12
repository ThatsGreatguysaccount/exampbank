import TidioWidget from "@/components/TidioWidget";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TidioWidget />
    </>
  );
}
