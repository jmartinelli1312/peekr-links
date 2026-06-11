import SignClient from "./SignClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Firmar acuerdo · Peekr",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SignClient token={token} />;
}
