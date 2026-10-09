import { PageEnter } from "@/components/motion";

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <PageEnter>{children}</PageEnter>;
}
