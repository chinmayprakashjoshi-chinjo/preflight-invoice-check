import { queryOptions } from "@tanstack/react-query";
import { getClients, getInvoices } from "./api";

export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: getClients,
  staleTime: Infinity,
});

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: getInvoices,
  staleTime: Infinity,
});
