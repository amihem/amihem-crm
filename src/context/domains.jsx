import { createDomainContext } from "./createDomainContext.jsx";
import { STORES } from "../services/dataService";

export const CustomersDomain = createDomainContext(STORES.customers);
export const ProductsDomain = createDomainContext(STORES.products);
export const TicketsDomain = createDomainContext(STORES.tickets);
export const FollowUpsDomain = createDomainContext(STORES.followups);
export const CallsDomain = createDomainContext(STORES.calls);
export const InventoryDomain = createDomainContext(STORES.inventory);
export const CollectionsDomain = createDomainContext(STORES.collections);
export const VisitsDomain = createDomainContext(STORES.visits);
export const AttachmentsDomain = createDomainContext(STORES.attachments);

export const useCustomers = CustomersDomain.useDomain;
export const useProducts = ProductsDomain.useDomain;
export const useTickets = TicketsDomain.useDomain;
export const useFollowUps = FollowUpsDomain.useDomain;
export const useCalls = CallsDomain.useDomain;
export const useInventory = InventoryDomain.useDomain;
export const useCollections = CollectionsDomain.useDomain;
export const useVisits = VisitsDomain.useDomain;
export const useAttachments = AttachmentsDomain.useDomain;

export function AppProviders({ children }) {
  return (
    <CustomersDomain.Provider>
      <ProductsDomain.Provider>
        <TicketsDomain.Provider>
          <FollowUpsDomain.Provider>
            <CallsDomain.Provider>
              <InventoryDomain.Provider>
                <CollectionsDomain.Provider>
                  <VisitsDomain.Provider>
                    <AttachmentsDomain.Provider>{children}</AttachmentsDomain.Provider>
                  </VisitsDomain.Provider>
                </CollectionsDomain.Provider>
              </InventoryDomain.Provider>
            </CallsDomain.Provider>
          </FollowUpsDomain.Provider>
        </TicketsDomain.Provider>
      </ProductsDomain.Provider>
    </CustomersDomain.Provider>
  );
}
