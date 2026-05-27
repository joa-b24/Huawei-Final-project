import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TabId = "diagnostico" | "estructura" | "relaciones" | "temporal" | "territorial";

export type AppState = {
  primaryState: string | null;
  activeTab: TabId;
  activeVariableIds: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_PRIMARY_STATE"; stateName: string | null }
  | { type: "SET_TAB"; tab: TabId }
  | { type: "TOGGLE_VARIABLE"; variableId: string }
  | { type: "SET_VARIABLES"; variableIds: string[] };

const MAX_ACTIVE_VARIABLES = 5;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_PRIMARY_STATE":
      return { ...state, primaryState: action.stateName };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "TOGGLE_VARIABLE": {
      const active = state.activeVariableIds.includes(action.variableId);
      if (active) {
        return { ...state, activeVariableIds: state.activeVariableIds.filter((v) => v !== action.variableId) };
      }
      if (state.activeVariableIds.length >= MAX_ACTIVE_VARIABLES) {
        return state;
      }
      return { ...state, activeVariableIds: [...state.activeVariableIds, action.variableId] };
    }
    case "SET_VARIABLES":
      return { ...state, activeVariableIds: action.variableIds.slice(0, MAX_ACTIVE_VARIABLES) };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_VARIABLES = [
  "poblacion_en_localidades_con_4g_garantizada_pct",
  "personas_usuarias_internet_pct",
  "rezago_educativo_pct",
  "pobreza_pct",
  "pib_per_capita",
];

const initialState: AppState = {
  primaryState: "Ciudad de Mexico",
  activeTab: "diagnostico",
  activeVariableIds: DEFAULT_VARIABLES,
};

type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<Action>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppProvider>");
  return ctx;
}

export const actions = {
  setPrimaryState: (stateName: string | null): Action => ({ type: "SET_PRIMARY_STATE", stateName }),
  setTab: (tab: TabId): Action => ({ type: "SET_TAB", tab }),
  toggleVariable: (variableId: string): Action => ({ type: "TOGGLE_VARIABLE", variableId }),
  setVariables: (variableIds: string[]): Action => ({ type: "SET_VARIABLES", variableIds }),
};
