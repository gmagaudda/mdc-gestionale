import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { CustomerForm } from "@/modules/customers/components/customer-form";
export default async function NewCustomerPage() {
  const user = await getSessionUser();
  if (!user || !["admin", "staff"].includes(user.role)) notFound();
  const t = await getTranslations("customers");
  return (
    <>
      <h1>{t("create")}</h1>
      <CustomerForm />
    </>
  );
}
