import { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import * as dataService from "../services/dataService";
import { newId } from "../utils/helpers";

// Factory that builds a Context + Provider + hook for one entity/store.
// Each domain (customers, products, tickets, followups) gets its own
// context via this factory — isolated state, shared plumbing.

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, items: action.items, loading: false };
    case "UPSERT": {
      const idx = state.items.findIndex((i) => i.id === action.item.id);
      const items = [...state.items];
      if (idx >= 0) items[idx] = action.item;
      else items.unshift(action.item);
      return { ...state, items };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    default:
      return state;
  }
}

export function createDomainContext(storeName) {
  const Ctx = createContext(null);

  function Provider({ children }) {
    const [state, dispatch] = useReducer(reducer, { items: [], loading: true });

    useEffect(() => {
      dataService.getAll(storeName).then((items) => dispatch({ type: "LOADED", items }));
    }, []);

    const save = useCallback(async (record) => {
      const withId = record.id ? record : { ...record, id: newId() };
      const saved = await dataService.put(storeName, withId);
      dispatch({ type: "UPSERT", item: saved });
      return saved;
    }, []);

    const remove = useCallback(async (id) => {
      await dataService.remove(storeName, id);
      dispatch({ type: "REMOVE", id });
    }, []);

    const value = { items: state.items, loading: state.loading, save, remove };
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  function useDomain() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error(`useDomain must be used within its Provider (${storeName})`);
    return ctx;
  }

  return { Provider, useDomain };
}
