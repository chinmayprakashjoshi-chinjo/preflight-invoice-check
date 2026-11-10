import { queryOptions } from "@tanstack/react-query";
import { getClients, listInvoices } from "./api";

export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: getClients,
  staleTime: Infinity,
});

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: listInvoices,
  staleTime: Infinity,
});
