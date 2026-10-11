import { uuid } from "zod";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { getCustomer } from "@/modules/customers/queries";
import { customerSchema } from "@/modules/customers/schema";
import { CustomerForm } from "@/modules/customers/components/customer-form";
export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !["admin", "staff"].includes(user.role)) notFound();
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const { customer } = await getCustomer(id);
  if (!customer.data) notFound();
  const initial = customerSchema.safeParse(customer.data);
  if (!initial.success) throw Error("INVALID_CUSTOMER_DATA");
  const t = await getTranslations("customers");
  return (
    <>
      <h1>{t("edit")}</h1>
      <CustomerForm id={id} initial={initial.data} />
    </>
  );
}
