import { createDomainContext } from "./createDomainContext.jsx";
import { STORES } from "../services/dataService";

export const CustomersDomain = createDomainContext(STORES.customers);
export const ProductsDomain = createDomainContext(STORES.products);
export const TicketsDomain = createDomainContext(STORES.tickets);
export const FollowUpsDomain = createDomainContext(STORES.followups);

export const useCustomers = CustomersDomain.useDomain;
export const useProducts = ProductsDomain.useDomain;
export const useTickets = TicketsDomain.useDomain;
export const useFollowUps = FollowUpsDomain.useDomain;

export function AppProviders({ children }) {
  return (
    <CustomersDomain.Provider>
      <ProductsDomain.Provider>
        <TicketsDomain.Provider>
          <FollowUpsDomain.Provider>{children}</FollowUpsDomain.Provider>
        </TicketsDomain.Provider>
      </ProductsDomain.Provider>
    </CustomersDomain.Provider>
  );
}
