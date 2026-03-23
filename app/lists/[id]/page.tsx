import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListsDetailRootRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/es/lists/${id}`);
}
