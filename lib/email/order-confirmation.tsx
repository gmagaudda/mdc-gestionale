import { z } from "zod";
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  render,
  toPlainText,
} from "react-email";
import messages from "@/messages/it.json";
import { formatMoney } from "@/lib/money";
const cents = z.string().regex(/^\d+$/);
export const orderConfirmationSchema = z.strictObject({
  number: z.string(),
  brand: z.string(),
  customer: z.string(),
  season: z.string(),
  order_date: z.iso.date(),
  delivery_date: z.iso.date().nullable(),
  payment_terms: z.string(),
  discount_pct: z.number().min(0).max(100),
  net_cents: cents,
  vat_cents: cents,
  gross_cents: cents,
  lines: z
    .array(
      z.strictObject({
        product: z.string(),
        sku: z.string(),
        color: z.string(),
        size: z.string(),
        quantity: z.number().int().positive(),
        unit_cents: cents,
        discount_pct: z.number().min(0).max(100),
        vat_rate: z.number().min(0).max(100),
        net_cents: cents,
      }),
    )
    .min(1)
    .max(500),
});
export async function renderOrderConfirmation(
  order: z.infer<typeof orderConfirmationSchema>,
) {
  const copy = messages.orders,
    email = messages.orderEmail;
  const money = (value: string) => formatMoney(BigInt(value));
  const date = (value: string) =>
    new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
  const percent = (value: number) =>
    `${new Intl.NumberFormat("it-IT").format(value)}%`;
  const subject = `${email.subject} ${order.number}`;
  const html = await render(
    <Html lang="it">
      <Head />
      <Body>
        <Container>
          <Heading as="h1">{subject}</Heading>
          <Text>
            {copy.brand}: {order.brand}
          </Text>
          <Text>
            {copy.customer}: {order.customer}
          </Text>
          <Text>
            {copy.season}: {order.season}
          </Text>
          <Text>
            {copy.order_date}: {date(order.order_date)}
          </Text>
          {order.delivery_date && (
            <Text>
              {copy.delivery_date}: {date(order.delivery_date)}
            </Text>
          )}
          {order.payment_terms && (
            <Text>
              {copy.payment_terms}: {order.payment_terms}
            </Text>
          )}
          <Text>
            {copy.discount_pct}: {percent(order.discount_pct)}
          </Text>
          <Heading as="h2">{copy.lines}</Heading>
          {order.lines.map((line, index) => (
            <Text key={index}>
              {line.product}. {copy.sku}: {line.sku}. {copy.color}: {line.color}
              . {copy.size}: {line.size}. {copy.quantity}: {line.quantity}.{" "}
              {copy.unit_price_cents}: {money(line.unit_cents)}.{" "}
              {copy.line_discount_pct}: {percent(line.discount_pct)}.{" "}
              {copy.vat_rate}: {percent(line.vat_rate)}. {copy.net}:{" "}
              {money(line.net_cents)}.
            </Text>
          ))}
          <Heading as="h2">{email.totals}</Heading>
          <Text>
            {copy.net}: {money(order.net_cents)}
          </Text>
          <Text>
            {copy.vat}: {money(order.vat_cents)}
          </Text>
          <Text>
            {copy.gross}: {money(order.gross_cents)}
          </Text>
          <Text>{email.footer}</Text>
        </Container>
      </Body>
    </Html>,
  );
  return { subject, html, text: toPlainText(html) };
}
