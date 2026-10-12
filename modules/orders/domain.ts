import type { Role } from "@/lib/auth/roles";
import type { OrderStatus } from "./schema";
const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["invoiced"],
  invoiced: [],
  cancelled: [],
};
export function allowedTransitions(
  status: OrderStatus,
  role: Role,
): OrderStatus[] {
  if (role === "brand") return [];
  return transitions[status].filter(
    (next) => role !== "accounting" || next === "invoiced",
  );
}
export function canTransition(from: OrderStatus, to: OrderStatus, role: Role) {
  return allowedTransitions(from, role).includes(to);
}
