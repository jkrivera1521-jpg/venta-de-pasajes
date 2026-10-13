import { redirect } from "next/navigation";

export default function Home() {
  redirect("/__PACKAGE_SEGMENT__/embedded");
}
